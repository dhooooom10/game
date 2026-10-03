package app.mathclash.game;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Play Billing (منتجات داخل التطبيق: لمرة واحدة) إلى JavaScript.
 * يُستدعى من public/src/net/billing.js عبر Capacitor.registerPlugin('Billing').
 * التحقق من الشراء يتم على خادم اللعبة (Google Play Developer API)، ثم يُقرّ (acknowledge) أو يُستهلك.
 */
@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private PluginCall pendingPurchase;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    private interface Ready { void run(); }

    private void withConnection(PluginCall call, Ready r) {
        if (client.isReady()) { r.run(); return; }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult res) {
                if (res.getResponseCode() == BillingClient.BillingResponseCode.OK) r.run();
                else call.reject("billing_unavailable", String.valueOf(res.getResponseCode()));
            }
            @Override public void onBillingServiceDisconnected() { /* إعادة الاتصال تلقائية */ }
        });
    }

    private static JSObject purchaseJson(Purchase p) {
        JSObject o = new JSObject();
        o.put("token", p.getPurchaseToken());
        o.put("orderId", p.getOrderId());
        o.put("acknowledged", p.isAcknowledged());
        o.put("state", p.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "purchased" : p.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "unknown");
        JSArray ids = new JSArray();
        for (String id : p.getProducts()) ids.put(id);
        o.put("products", ids);
        return o;
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null || ids.length() == 0) { call.reject("ids_required"); return; }
        withConnection(call, () -> {
            List<QueryProductDetailsParams.Product> list = new ArrayList<>();
            try {
                for (int i = 0; i < ids.length(); i++) list.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(ids.getString(i)).setProductType(BillingClient.ProductType.INAPP).build());
            } catch (Exception e) { call.reject("bad_ids"); return; }
            client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (res, result) -> {
                if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("query_failed", String.valueOf(res.getResponseCode())); return; }
                JSArray out = new JSArray();
                for (ProductDetails d : result.getProductDetailsList()) {
                    details.put(d.getProductId(), d);
                    JSObject o = new JSObject();
                    o.put("id", d.getProductId());
                    o.put("title", d.getName());
                    o.put("description", d.getDescription());
                    ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
                    o.put("price", offer != null ? offer.getFormattedPrice() : "");
                    out.put(o);
                }
                JSObject r = new JSObject(); r.put("products", out); call.resolve(r);
            });
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String id = call.getString("id", "");
        ProductDetails d = details.get(id);
        if (d == null) { call.reject("unknown_product"); return; }
        if (pendingPurchase != null) { call.reject("busy"); return; }
        withConnection(call, () -> {
            List<BillingFlowParams.ProductDetailsParams> p = new ArrayList<>();
            p.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build());
            BillingFlowParams.Builder b = BillingFlowParams.newBuilder().setProductDetailsParamsList(p);
            String account = call.getString("accountId", null);
            if (account != null && !account.isEmpty()) b.setObfuscatedAccountId(account);
            pendingPurchase = call;
            call.setKeepAlive(true);
            BillingResult res = client.launchBillingFlow(getActivity(), b.build());
            if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                pendingPurchase = null; call.setKeepAlive(false);
                call.reject("launch_failed", String.valueOf(res.getResponseCode()));
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult res, List<Purchase> purchases) {
        PluginCall call = pendingPurchase;
        pendingPurchase = null;
        JSObject r = new JSObject();
        int code = res.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            r.put("status", "ok");
            r.put("purchase", purchaseJson(purchases.get(0)));
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) r.put("status", "cancelled");
        else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) r.put("status", "owned");
        else { r.put("status", "error"); r.put("code", code); }
        if (call != null) { call.setKeepAlive(false); call.resolve(r); }
        else notifyListeners("purchaseUpdated", r);
    }

    /** المشتريات الحالية (للاسترجاع على جهاز جديد أو بعد إعادة التثبيت) */
    @PluginMethod
    public void queryPurchases(PluginCall call) {
        withConnection(call, () -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (res, list) -> {
                if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("query_failed", String.valueOf(res.getResponseCode())); return; }
                JSArray out = new JSArray();
                for (Purchase p : list) out.put(purchaseJson(p));
                JSObject r = new JSObject(); r.put("purchases", out); call.resolve(r);
            }));
    }

    @PluginMethod
    public void acknowledge(PluginCall call) {
        String token = call.getString("token", "");
        withConnection(call, () -> client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), res -> {
            if (res.getResponseCode() == BillingClient.BillingResponseCode.OK) call.resolve(); else call.reject("ack_failed", String.valueOf(res.getResponseCode()));
        }));
    }

    @PluginMethod
    public void consume(PluginCall call) {
        String token = call.getString("token", "");
        withConnection(call, () -> client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (res, t) -> {
            if (res.getResponseCode() == BillingClient.BillingResponseCode.OK) call.resolve(); else call.reject("consume_failed", String.valueOf(res.getResponseCode()));
        }));
    }
}
