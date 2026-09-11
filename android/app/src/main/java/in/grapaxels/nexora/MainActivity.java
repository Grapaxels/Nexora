package in.grapaxels.nexora;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.security.SecureRandom;
import android.util.Base64;

public class MainActivity extends Activity {
  private static final String APP = "https://nexora.grapaxels.in";
  private WebView web;
  private String verifier;

  @SuppressLint("SetJavaScriptEnabled")
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setUserAgentString(web.getSettings().getUserAgentString() + " NexoraAndroid/1.0");
    web.setWebViewClient(new Browser());
    CookieManager.getInstance().setAcceptCookie(true);
    setContentView(web);
    if (getIntent().getData() != null) handleAuth(getIntent().getData()); else web.loadUrl(APP);
  }

  @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleAuth(intent.getData()); }
  private void handleAuth(Uri uri) {
    if (uri == null || !"nexora".equals(uri.getScheme()) || !"auth".equals(uri.getHost())) { web.loadUrl(APP); return; }
    String code = uri.getQueryParameter("code");
    if (code == null || verifier == null) { web.loadUrl(APP + "/?auth_error=expired"); return; }
    new Thread(() -> {
      try {
        URL endpoint = new URL(APP + "/api/auth/mobile?code=" + URLEncoder.encode(code, "UTF-8") + "&verifier=" + URLEncoder.encode(verifier, "UTF-8"));
        HttpURLConnection connection = (HttpURLConnection) endpoint.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent", "NexoraAndroid/1.0");
        connection.connect();
        String cookie = connection.getHeaderField("Set-Cookie");
        if (cookie != null) CookieManager.getInstance().setCookie(APP, cookie);
        CookieManager.getInstance().flush();
        runOnUiThread(() -> web.loadUrl(APP + "/?view=dashboard"));
      } catch (Exception exception) {
        runOnUiThread(() -> web.loadUrl(APP + "/?auth_error=mobile"));
      }
    }).start();
  }

  private final class Browser extends WebViewClient {
    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return open(request.getUrl()); }
    @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return open(Uri.parse(url)); }
    private boolean open(Uri uri) {
      String host = uri.getHost() == null ? "" : uri.getHost();
      if ("nexora".equals(uri.getScheme())) { handleAuth(uri); return true; }
      if (host.equals("nexora.grapaxels.in") || host.equals("api.nexora.grapaxels.in")) {
        if (uri.getPath() != null && uri.getPath().contains("/auth/oauth/")) beginMobile(uri);
        else web.loadUrl(uri.toString());
      } else { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
      return true;
    }
  }
  private void beginMobile(Uri url) {
    try {
      verifier = token();
      String challenge = digest(verifier);
      Uri next = url.buildUpon().appendQueryParameter("mobile", challenge).build();
      web.loadUrl(next.toString());
    } catch (Exception exception) { web.loadUrl(APP + "/?auth_error=mobile"); }
  }
  private static String token() {
    byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
    return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
  }
  private static String digest(String value) throws Exception {
    return Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes("UTF-8")), Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
  }
}
