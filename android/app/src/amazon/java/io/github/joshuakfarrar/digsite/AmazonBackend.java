package io.github.joshuakfarrar.digsite;

import android.app.Activity;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import com.amazon.device.iap.PurchasingListener;
import com.amazon.device.iap.PurchasingService;
import com.amazon.device.iap.model.FulfillmentResult;
import com.amazon.device.iap.model.Product;
import com.amazon.device.iap.model.ProductDataResponse;
import com.amazon.device.iap.model.PurchaseResponse;
import com.amazon.device.iap.model.PurchaseUpdatesResponse;
import com.amazon.device.iap.model.Receipt;
import com.amazon.device.iap.model.RequestId;
import com.amazon.device.iap.model.UserDataResponse;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Amazon Appstore in-app purchasing (Fire tablets), for the one-time unlock, an "entitled" product
 * in Amazon's terms. Every call is a request whose answer comes back later to the listener, matched
 * up by its request id. Purchases are marked fulfilled here, on the device; there's no server.
 *
 * Pending purchases are on: in an Amazon Kids profile, a child's purchase goes to a parent to
 * approve, and the game hears "pending". When it's approved, the purchase turns up in the purchase
 * updates asked for each time the app comes back to the front.
 */
final class AmazonBackend implements StoreBackend, PurchasingListener {
    private final Context context;
    private final boolean hasAppstore;
    private Owned onOwned = (id) -> {};
    private final Map<RequestId, Callback<String>> prices = new HashMap<>();
    private final Map<RequestId, String> priceSkus = new HashMap<>();
    private final Map<RequestId, Callback<String>> buys = new HashMap<>();
    /** Restores in flight, by request id, carried across pages of purchase updates. */
    private final Map<RequestId, Restore> restores = new HashMap<>();
    private boolean started;

    private static final class Restore {
        final String sku;
        final Callback<String> done; // null for the quiet check on coming back to the front
        boolean owned;

        Restore(String sku, Callback<String> done) {
            this.sku = sku;
            this.done = done;
        }
    }

    AmazonBackend(Context context) {
        this.context = context.getApplicationContext();
        // Only sells with the Amazon Appstore on the device and the app's public key built in (from
        // the Amazon developer console, src/amazon/assets/AppstoreAuthenticationKey.pem). Without
        // the key Amazon never answers, so a build missing it must not lock anything.
        // A debug build may stand in Amazon's App Tester for the key: with the tablet in sandbox
        // mode (`adb shell setprop debug.amazon.sandboxmode debug`), App Tester answers instead of
        // the Appstore. See docs/android.md. A release build always needs the real key.
        boolean debuggable = (this.context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        hasAppstore = installed("com.amazon.venezia") && (hasKey() || (debuggable && installed("com.amazon.sdktestclient")));
    }

    private boolean installed(String pkg) {
        try {
            context.getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private boolean hasKey() {
        try (InputStream in = context.getAssets().open("AppstoreAuthenticationKey.pem")) {
            return in.read() != -1;
        } catch (IOException e) {
            return false;
        }
    }

    @Override
    public boolean sells() {
        return hasAppstore;
    }

    @Override
    public void start(Owned onOwned) {
        this.onOwned = onOwned;
        if (!hasAppstore || started) return;
        started = true;
        PurchasingService.enablePendingPurchases();
        PurchasingService.registerListener(context, this);
    }

    @Override
    public void resumed() {
        if (!started) return;
        // Anything bought or approved while the game was away (a parent approving it, say).
        restores.put(PurchasingService.getPurchaseUpdates(false), new Restore(null, null));
    }

    @Override
    public void price(String productId, Callback<String> done) {
        if (!started) {
            done.done(null);
            return;
        }
        RequestId id = PurchasingService.getProductData(Collections.singleton(productId));
        prices.put(id, done);
        priceSkus.put(id, productId);
    }

    @Override
    public void buy(Activity activity, String productId, Callback<String> done) {
        if (!started) {
            done.done("unavailable");
            return;
        }
        buys.put(PurchasingService.purchase(productId), done);
    }

    @Override
    public void restore(String productId, Callback<String> done) {
        if (!started) {
            done.done("unavailable");
            return;
        }
        // From the start (true): everything this account owns, for a new or reset device.
        restores.put(PurchasingService.getPurchaseUpdates(true), new Restore(productId, done));
    }

    @Override
    public void stop() {}

    // ------------------------------------------------------------------ Amazon's answers

    @Override
    public void onUserDataResponse(UserDataResponse response) {}

    @Override
    public void onProductDataResponse(ProductDataResponse response) {
        Callback<String> done = prices.remove(response.getRequestId());
        String sku = priceSkus.remove(response.getRequestId());
        if (done == null) return;
        Product p = response.getRequestStatus() == ProductDataResponse.RequestStatus.SUCCESSFUL && response.getProductData() != null
            ? response.getProductData().get(sku) : null;
        done.done(p == null ? null : p.getPrice());
    }

    @Override
    public void onPurchaseResponse(PurchaseResponse response) {
        Callback<String> done = buys.remove(response.getRequestId());
        String outcome;
        switch (response.getRequestStatus()) {
            case SUCCESSFUL:
                Receipt r = response.getReceipt();
                if (r != null && !r.isCanceled()) {
                    PurchasingService.notifyFulfillment(r.getReceiptId(), FulfillmentResult.FULFILLED);
                    onOwned.owned(r.getSku());
                    outcome = "bought";
                } else outcome = "failed";
                break;
            case ALREADY_PURCHASED:
                outcome = "bought";
                break;
            case PENDING:
                outcome = "pending";
                break;
            case INVALID_SKU:
            case NOT_SUPPORTED:
                outcome = "unavailable";
                break;
            default:
                // FAILED covers the buyer closing Amazon's sheet too; the game treats that as a cancel.
                outcome = "cancelled";
        }
        if (done != null) done.done(outcome);
    }

    @Override
    public void onPurchaseUpdatesResponse(PurchaseUpdatesResponse response) {
        Restore r = restores.remove(response.getRequestId());
        if (r == null) return;
        if (response.getRequestStatus() != PurchaseUpdatesResponse.RequestStatus.SUCCESSFUL) {
            if (r.done != null) r.done.done("unavailable");
            return;
        }
        for (Receipt receipt : response.getReceipts()) {
            if (receipt.isCanceled()) continue;
            PurchasingService.notifyFulfillment(receipt.getReceiptId(), FulfillmentResult.FULFILLED);
            onOwned.owned(receipt.getSku());
            if (receipt.getSku().equals(r.sku)) r.owned = true;
        }
        if (response.hasMore()) {
            restores.put(PurchasingService.getPurchaseUpdates(false), r);
            return;
        }
        if (r.done != null) r.done.done(r.owned ? "bought" : "none");
    }
}
