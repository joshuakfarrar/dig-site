package io.github.joshuakfarrar.digsite;

import android.content.Context;

/** The Amazon Appstore build's store. Amazon's in-app purchasing comes next; until then, nothing's sold. */
final class Backends {
    private Backends() {}

    static StoreBackend create(Context context) {
        return new StoreBackend.None();
    }
}
