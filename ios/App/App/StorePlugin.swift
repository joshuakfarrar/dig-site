import Capacitor
import StoreKit

/**
 * The game's one purchase on iOS, through StoreKit 2: the same calls as Android's StorePlugin, for
 * `src/shop.ts`. `sells`, `price`, `buy` and `restore`, plus an "owned" event when a purchase goes
 * through later ("Ask to Buy", where a parent approves a child's purchase on their own device) and
 * a "revoked" event when Apple refunds it.
 *
 * The product is `full_game`, a non-consumable. Transactions are checked by StoreKit on the device
 * (`.verified`) and finished here; there's no server, and nothing about the buyer reaches the game.
 * Registered by GameViewController (AppDelegate.swift).
 */
@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sells", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "price", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    private var updates: Task<Void, Never>?

    override public func load() {
        // Purchases that land while the game's open, or that were waiting from before: an approved
        // Ask to Buy, a purchase from another device, an interrupted one finishing. And refunds:
        // Apple sets `revocationDate` when it takes a purchase back, which re-locks the game.
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard case .verified(let t) = result else { continue }
                await t.finish()
                self?.tell(t.revocationDate == nil ? "owned" : "revoked", t.productID)
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    private func tell(_ event: String, _ id: String) {
        notifyListeners(event, data: ["id": id], retainUntilConsumed: true)
    }

    /// The App Store's always there to sell through. (If a parent's turned purchases off in Screen
    /// Time, buying says so; the game stays locked rather than handing out the unlock.)
    @objc func sells(_ call: CAPPluginCall) {
        call.resolve(["sells": true])
    }

    @objc func price(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("No product id") }
        Task {
            let product = try? await Product.products(for: [id]).first
            call.resolve(product.map { ["price": $0.displayPrice] } ?? [:])
        }
    }

    /// Buys it with Apple's sheet shown over the game's own window. Without the scene, StoreKit can
    /// fail to find one to show the sheet in ("Payment Sheet Failed: Presentation failed").
    @MainActor
    private func purchase(_ product: Product) async throws -> Product.PurchaseResult {
        if #available(iOS 17.0, *), let scene = bridge?.viewController?.view.window?.windowScene {
            return try await product.purchase(confirmIn: scene)
        }
        return try await product.purchase()
    }

    @objc func buy(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("No product id") }
        Task { @MainActor in
            guard AppStore.canMakePayments else { return call.resolve(["outcome": "unavailable"]) }
            // The product can't be looked up (offline, or the store's not answering): "unavailable",
            // so the card says to check the device is online, rather than that something went wrong.
            guard let product = try? await Product.products(for: [id]).first else {
                return call.resolve(["outcome": "unavailable"])
            }
            do {
                switch try await purchase(product) {
                case .success(let result):
                    if case .verified(let t) = result {
                        await t.finish()
                        call.resolve(["outcome": "bought"])
                    } else {
                        call.resolve(["outcome": "failed"])
                    }
                case .pending:
                    call.resolve(["outcome": "pending"]) // Ask to Buy: "owned" comes later
                case .userCancelled:
                    call.resolve(["outcome": "cancelled"])
                @unknown default:
                    call.resolve(["outcome": "failed"])
                }
            } catch {
                call.resolve(["outcome": "failed"])
            }
        }
    }

    /// Whether `full_game` is owned. Quietly (`quiet: true`, at the game's start) it only looks at
    /// what StoreKit already knows, which works offline. From the "Restore purchase" button it first
    /// syncs with the App Store, which may ask the buyer to sign in, as Apple expects.
    @objc func restore(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("No product id") }
        let quiet = call.getBool("quiet") ?? false
        Task {
            var cancelled = false
            if !quiet {
                do {
                    try await AppStore.sync()
                } catch StoreKitError.userCancelled {
                    cancelled = true // they backed out of signing in: nothing was looked up
                } catch {
                    // Offline: still say what's known on the device.
                }
            }
            for await result in Transaction.currentEntitlements {
                if case .verified(let t) = result, t.productID == id, t.revocationDate == nil {
                    return call.resolve(["outcome": "bought"])
                }
            }
            // Not owned now. Was it bought and then refunded? Apple says so outright, and that
            // re-locks the game; anything else ("none") leaves what the device remembers alone.
            if case .verified(let t)? = await Transaction.latest(for: id), t.revocationDate != nil {
                return call.resolve(["outcome": "revoked"])
            }
            // "none" only when the App Store was asked; a cancelled sign-in isn't "no purchase found".
            call.resolve(["outcome": cancelled ? "cancelled" : "none"])
        }
    }
}
