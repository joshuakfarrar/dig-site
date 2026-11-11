package io.github.joshuakfarrar.digsite;

import android.content.Context;

/** The Amazon Appstore build's store. */
final class Backends {
    private Backends() {}

    static StoreBackend create(Context context) {
        return new AmazonBackend(context);
    }
}
