package io.github.joshuakfarrar.digsite;

import android.app.Activity;

/**
 * One app store's purchases, behind the same few calls: Google Play's in the `play` build, Amazon's
 * in the `amazon` build (each build's own `Backends` picks it). The game sells one thing, the full
 * game, as a one-time purchase.
 *
 * Outcomes are plain words the game understands: "bought", "pending" (paid by a method that takes a
 * while, like cash at a shop; it unlocks when it clears), "cancelled", "none" (restore found
 * nothing), "failed" and "unavailable" (no store to talk to).
 */
public interface StoreBackend {
    interface Callback<T> {
        void done(T value);
    }

    /** Told when something's owned outside a purchase call, like a pending payment clearing. */
    interface Owned {
        void owned(String productId);
    }

    /** True if this build can sell at all (not whether the store's reachable right now). */
    boolean sells();

    void start(Owned onOwned);

    /** The store's price in the buyer's currency, like "$2.99", or null if it can't say. */
    void price(String productId, Callback<String> done);

    /** Shows the store's own purchase sheet. Called on the UI thread. */
    void buy(Activity activity, String productId, Callback<String> done);

    void restore(String productId, Callback<String> done);

    void stop();

    /** For a build with no store: nothing to sell, and every call says so. */
    final class None implements StoreBackend {
        public boolean sells() { return false; }
        public void start(Owned onOwned) {}
        public void price(String productId, Callback<String> done) { done.done(null); }
        public void buy(Activity activity, String productId, Callback<String> done) { done.done("unavailable"); }
        public void restore(String productId, Callback<String> done) { done.done("unavailable"); }
        public void stop() {}
    }
}
