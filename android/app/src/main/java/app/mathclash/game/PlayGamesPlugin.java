package app.mathclash.game;

import android.app.Activity;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;

/**
 * جسر Google Play Games Services (v2) إلى JavaScript.
 * يُستدعى من public/src/net/playgames.js عبر Capacitor.registerPlugin('PlayGames').
 * إن لم يُضبط game_services_project_id (res/values/playgames.xml) ترفض كل الدوال بهدوء "not_configured".
 */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {
    private static final int RC_UI = 9004;
    private boolean ready = false;

    @Override
    public void load() {
        String appId = getContext().getString(R.string.game_services_project_id);
        if (appId != null && appId.trim().matches("\\d{6,}")) {
            PlayGamesSdk.initialize(getContext());
            ready = true;
        }
    }

    private boolean check(PluginCall call) {
        if (!ready) { call.reject("not_configured"); return false; }
        if (getActivity() == null) { call.reject("no_activity"); return false; }
        return true;
    }

    private static JSObject auth(boolean ok) { JSObject r = new JSObject(); r.put("authenticated", ok); return r; }

    @PluginMethod
    public void isAuthenticated(PluginCall call) {
        if (!check(call)) return;
        PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(t ->
            call.resolve(auth(t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated())));
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!check(call)) return;
        PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(t ->
            call.resolve(auth(t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated())));
    }

    /** رمز لمرة واحدة يتحقق منه خادم اللعبة (POST /api/auth/playgames) */
    @PluginMethod
    public void requestServerSideAccess(PluginCall call) {
        if (!check(call)) return;
        String clientId = call.getString("clientId", "");
        if (clientId == null || clientId.isEmpty()) { call.reject("client_id_required"); return; }
        PlayGames.getGamesSignInClient(getActivity()).requestServerSideAccess(clientId, false).addOnCompleteListener(t -> {
            if (t.isSuccessful() && t.getResult() != null) { JSObject r = new JSObject(); r.put("authCode", t.getResult()); call.resolve(r); }
            else call.reject("server_access_failed", t.getException());
        });
    }

    @PluginMethod
    public void getPlayer(PluginCall call) {
        if (!check(call)) return;
        PlayGames.getPlayersClient(getActivity()).getCurrentPlayer().addOnCompleteListener(t -> {
            if (t.isSuccessful() && t.getResult() != null) {
                JSObject r = new JSObject();
                r.put("playerId", t.getResult().getPlayerId());
                r.put("displayName", t.getResult().getDisplayName());
                call.resolve(r);
            } else call.reject("player_failed", t.getException());
        });
    }

    @PluginMethod
    public void unlockAchievement(PluginCall call) {
        if (!check(call)) return;
        String id = call.getString("achievementId", "");
        if (id == null || id.isEmpty()) { call.reject("id_required"); return; }
        PlayGames.getAchievementsClient(getActivity()).unlock(id);
        call.resolve();
    }

    @PluginMethod
    public void submitScore(PluginCall call) {
        if (!check(call)) return;
        String id = call.getString("leaderboardId", "");
        Long score = call.getLong("score");
        if (id == null || id.isEmpty() || score == null) { call.reject("bad_args"); return; }
        PlayGames.getLeaderboardsClient(getActivity()).submitScore(id, score);
        call.resolve();
    }

    @PluginMethod
    public void showLeaderboards(PluginCall call) {
        if (!check(call)) return;
        Activity a = getActivity();
        PlayGames.getLeaderboardsClient(a).getAllLeaderboardsIntent().addOnCompleteListener(t -> showIntent(call, a, t.isSuccessful() ? t.getResult() : null));
    }

    @PluginMethod
    public void showAchievements(PluginCall call) {
        if (!check(call)) return;
        Activity a = getActivity();
        PlayGames.getAchievementsClient(a).getAchievementsIntent().addOnCompleteListener(t -> showIntent(call, a, t.isSuccessful() ? t.getResult() : null));
    }

    @SuppressWarnings("deprecation")
    private void showIntent(PluginCall call, Activity a, Intent intent) {
        if (intent == null) { call.reject("ui_failed"); return; }
        a.startActivityForResult(intent, RC_UI);
        call.resolve();
    }
}
