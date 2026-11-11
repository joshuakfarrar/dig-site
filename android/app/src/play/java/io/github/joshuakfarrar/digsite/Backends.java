package io.github.joshuakfarrar.digsite;

import android.content.Context;

/** The Google Play build's store. */
final class Backends {
    private Backends() {}

    static StoreBackend create(Context context) {
        return new PlayBackend(context);
    }
}
