package io.github.joshuakfarrar.digsite;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The game's one purchase, for `src/shop.ts`: `sells`, `price`, `buy` and `restore`, plus an
 * "owned" event when a purchase goes through later (a pending payment clearing). This build's store
 * comes from `Backends`: Google Play or Amazon. Nothing here talks to anything but the store app on
 * the device, and nothing about the buyer reaches the game.
 */
@CapacitorPlugin(name = "Store")
public class StorePlugin extends Plugin {
    private StoreBackend store;

    @Override
    public void load() {
        store = Backends.create(getContext());
        store.start((id) -> {
            JSObject o = new JSObject();
            o.put("id", id);
            notifyListeners("owned", o, true);
        });
    }

    @PluginMethod
    public void sells(PluginCall call) {
        JSObject r = new JSObject();
        r.put("sells", store.sells());
        call.resolve(r);
    }

    @PluginMethod
    public void price(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("No product id");
            return;
        }
        store.price(id, (p) -> {
            JSObject r = new JSObject();
            if (p != null) r.put("price", p);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void buy(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("No product id");
            return;
        }
        // The store's sheet has to be opened from the UI thread.
        getActivity().runOnUiThread(() -> store.buy(getActivity(), id, (o) -> resolveOutcome(call, o)));
    }

    @PluginMethod
    public void restore(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("No product id");
            return;
        }
        getActivity().runOnUiThread(() -> store.restore(id, (o) -> resolveOutcome(call, o)));
    }

    private static void resolveOutcome(PluginCall call, String outcome) {
        JSObject r = new JSObject();
        r.put("outcome", outcome);
        call.resolve(r);
    }

    @Override
    protected void handleOnDestroy() {
        if (store != null) store.stop();
    }
}
