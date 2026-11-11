package io.github.joshuakfarrar.digsite;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Play Billing, for the one-time unlock. Purchases are acknowledged here, on the device
 * (Google refunds one that's never acknowledged within three days); there's no server, and the game
 * only ever learns "owned" or not.
 */
final class PlayBackend implements StoreBackend, PurchasesUpdatedListener {
    private final BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private final List<Callback<Boolean>> waiting = new ArrayList<>();
    private boolean connecting;
    private Owned onOwned = (id) -> {};
    private Callback<String> buying;

    private final boolean hasPlay;

    PlayBackend(Context context) {
        // The Play Store's billing service on this device? (Not on a Fire tablet, say, if this build
        // were put on one by hand.) Without it nothing can be sold, so nothing is locked.
        Intent bind = new Intent("com.android.vending.billing.InAppBillingService.BIND").setPackage("com.android.vending");
        hasPlay = !context.getPackageManager().queryIntentServices(bind, 0).isEmpty();
        client = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    @Override
    public boolean sells() {
        return hasPlay;
    }

    @Override
    public void start(Owned onOwned) {
        this.onOwned = onOwned;
        if (hasPlay) whenReady((ok) -> {});
    }

    /** Runs `then` once connected to Play (true), or once that's failed (false). */
    private void whenReady(Callback<Boolean> then) {
        if (client.isReady()) {
            then.done(true);
            return;
        }
        waiting.add(then);
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                connecting = false;
                boolean ok = result.getResponseCode() == BillingClient.BillingResponseCode.OK;
                List<Callback<Boolean>> now = new ArrayList<>(waiting);
                waiting.clear();
                for (Callback<Boolean> c : now) c.done(ok);
            }

            @Override
            public void onBillingServiceDisconnected() {
                connecting = false;
            }
        });
    }

    private void productDetails(String id, Callback<ProductDetails> done) {
        ProductDetails known = details.get(id);
        if (known != null) {
            done.done(known);
            return;
        }
        whenReady((ok) -> {
            if (!ok) {
                done.done(null);
                return;
            }
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()))
                .build();
            client.queryProductDetailsAsync(params, (result, found) -> {
                List<ProductDetails> list = found.getProductDetailsList();
                ProductDetails pd = result.getResponseCode() == BillingClient.BillingResponseCode.OK && !list.isEmpty() ? list.get(0) : null;
                if (pd != null) details.put(id, pd);
                done.done(pd);
            });
        });
    }

    @Override
    public void price(String productId, Callback<String> done) {
        productDetails(productId, (pd) -> {
            ProductDetails.OneTimePurchaseOfferDetails offer = pd == null ? null : pd.getOneTimePurchaseOfferDetails();
            done.done(offer == null ? null : offer.getFormattedPrice());
        });
    }

    @Override
    public void buy(Activity activity, String productId, Callback<String> done) {
        productDetails(productId, (pd) -> {
            if (pd == null) {
                done.done("unavailable");
                return;
            }
            buying = done;
            BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).build()))
                .build();
            activity.runOnUiThread(() -> {
                BillingResult r = client.launchBillingFlow(activity, params);
                int code = r.getResponseCode();
                if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) restore(productId, this::finish);
                else if (code != BillingClient.BillingResponseCode.OK) finish(outcomeOf(code));
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            String outcome = "failed";
            for (Purchase p : purchases) {
                String o = settle(p);
                if (o.equals("bought") || (o.equals("pending") && !outcome.equals("bought"))) outcome = o;
            }
            finish(outcome);
        } else finish(outcomeOf(code));
    }

    private static String outcomeOf(int code) {
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) return "cancelled";
        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) return "bought";
        if (code == BillingClient.BillingResponseCode.BILLING_UNAVAILABLE
            || code == BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE
            || code == BillingClient.BillingResponseCode.ITEM_UNAVAILABLE) return "unavailable";
        return "failed";
    }

    /** Acknowledges a paid purchase and tells the game; says what it was. */
    private String settle(Purchase p) {
        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            if (!p.isAcknowledged()) {
                client.acknowledgePurchase(
                    AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                    (r) -> {});
            }
            for (String id : p.getProducts()) onOwned.owned(id);
            return "bought";
        }
        if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) return "pending";
        return "failed";
    }

    /** Answers the purchase call that's waiting, if there is one. (A pending payment clearing later has none.) */
    private void finish(String outcome) {
        Callback<String> c = buying;
        buying = null;
        if (c != null) c.done(outcome);
    }

    @Override
    public void restore(String productId, Callback<String> done) {
        whenReady((ok) -> {
            if (!ok) {
                done.done("unavailable");
                return;
            }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (result, list) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        done.done("unavailable");
                        return;
                    }
                    String outcome = "none";
                    for (Purchase p : list) {
                        if (!p.getProducts().contains(productId)) continue;
                        String o = settle(p);
                        if (o.equals("bought")) outcome = "bought";
                        else if (o.equals("pending") && outcome.equals("none")) outcome = "pending";
                    }
                    done.done(outcome);
                });
        });
    }

    @Override
    public void stop() {
        client.endConnection();
    }
}
