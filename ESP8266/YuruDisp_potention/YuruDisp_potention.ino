// ==========================
// ESP8266(NodeMCU) + Pot(50k) + TM1637 + Web(HTTP)
//  - キャリブボタン押下中に動いた最小～最大を学習
//  - その区間を 0..100 に線形マップして表示＆HTTP配信
//  - 将来WiFiManagerへ差し替えやすい構成
// ==========================

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <TM1637Display.h>
#include <WiFiUdp.h>

// --------- ピン定義 ----------
#define CALIB_BUTTON_PIN D3   // 押すとLOW（内部プルアップ）
#define TM1637_CLK_PIN   D1
#define TM1637_DIO_PIN   D2

// --------- Wi-Fi（将来WiFiManager差し替え想定） ----------
const char* WIFI_SSID = "SSID";
const char* WIFI_PASS = "WifiPass";

// --------- オブジェクト ----------
ESP8266WebServer server(80);
TM1637Display display(TM1637_CLK_PIN, TM1637_DIO_PIN);

WiFiUDP udp;
const uint16_t DISCOVERY_PORT = 4210;
String deviceId;

// --------- 状態・パラメータ ----------
bool calibHolding = false;
bool calibrated   = false;
int  calibMin     = 0;
int  calibMax     = 1023;   // NodeMCUの多くは0..1023スケール

uint32_t lastDispMs = 0;

// --------- 平滑化付きA0読み取り ----------
int readA0Smooth() {
  // 中央値3 + 平均32：軽量で滑らか
  int a = analogRead(A0); delayMicroseconds(120);
  int b = analogRead(A0); delayMicroseconds(120);
  int c = analogRead(A0); delayMicroseconds(120);

  // 中央値
  int med = (a < b) ? ((b < c) ? b : (a < c ? c : a))
                    : ((a < c) ? a : (b < c ? c : b));

  long acc = 0;
  for (int i = 0; i < 32; i++) {
    acc += analogRead(A0);
    delayMicroseconds(80);
  }
  int avg = acc / 32;

  return (med + avg) / 2;
}

// 0..100 へマップ（四捨五入＆クランプ）
int mapTo0_100(long raw, long mn, long mx) {
  if (mx == mn) return 0;
  long num = (raw - mn) * 100L;
  long den = (mx - mn);
  long val = (num >= 0) ? (num + den/2) / den : (num - den/2) / den;
  if (val < 0) val = 0;
  if (val > 100) val = 100;
  return (int)val;
}

// ---- シンプルなWeb UI ----
const char* INDEX_HTML = R"HTML(
<!doctype html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESP8266 Pot Monitor</title>
<style>
body{font-family:sans-serif;margin:2rem;}h1{margin:.2rem 0 1rem}
.card{border:1px solid #ddd;border-radius:8px;padding:1rem;max-width:420px}
.row{display:flex;justify-content:space-between;margin:.3rem 0}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace}
.btn{display:inline-block;padding:.4rem .7rem;border:1px solid #333;border-radius:6px;text-decoration:none;color:#333}
.btn:hover{background:#f2f2f2}.small{color:#666;font-size:.9rem}
</style>
</head>
<body>
<h1>Pot Monitor</h1>
<div class="card">
  <div class="row"><div>Raw (A0)</div><h1><div id="raw" class="mono">-</div></h1></div>
  <div class="row"><div>Mapped (0–100)</div><h1><div id="val" class="mono">-</div></h1></div>
  <div class="row small"><div>Range</div><div class="mono"><span id="mn">-</span> .. <span id="mx">-</span></div></div>
  <div style="margin-top:1rem">
    <a class="btn" href="/reset">Reset calibration</a>
    <a class="btn" href="/api">JSON</a>
  </div>
</div>
<script>
async function tick(){
  try{
    const r = await fetch('/api');
    const j = await r.json();
    raw.textContent = j.raw;
    val.textContent = j.calibrated_value;
    mn.textContent = j.calib_min;
    mx.textContent = j.calib_max;
  }catch(e){}
}
setInterval(tick,500); tick();
</script>
</body>
</html>
)HTML";

void handleRoot(){ server.send(200, "text/html; charset=utf-8", INDEX_HTML); }

void handleAPI(){
  int raw = readA0Smooth();
  int mapped = calibrated ? mapTo0_100(raw, calibMin, calibMax) : 0;
  String json = "{";
  json += "\"raw\":" + String(raw) + ",";
  json += "\"calibrated_value\":" + String(mapped) + ",";
  json += "\"calibrated\":" + String(calibrated ? "true" : "false") + ",";
  json += "\"calib_min\":" + String(calibMin) + ",";
  json += "\"calib_max\":" + String(calibMax);
  json += "}";
  server.send(200, "application/json; charset=utf-8", json);
}

void handleReset(){
  calibrated = false;
  calibMin = 0;
  calibMax = 1023;
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "Reset");
}

void setup() {
  Serial.begin(115200);
  delay(50);
  pinMode(CALIB_BUTTON_PIN, INPUT_PULLUP); // 押すとLOW
  display.setBrightness(7, true);
  display.showNumberDec(0, false);

  // ---- Wi-Fi（WiFiManagerに差し替え可）----
  // #include <WiFiManager.h>
  // WiFiManager wm; wm.autoConnect("PotConfigAP");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi connecting");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
    delay(300); Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected (continue offline HTTP won’t work).");
    // 必要ならAPフォールバックを有効化:
    // WiFi.mode(WIFI_AP); WiFi.softAP("PotAP","password1234");
    // Serial.print("AP IP: "); Serial.println(WiFi.softAPIP());
  }

  // ---- Webサーバ ----
  server.on("/", handleRoot);
  server.on("/api", handleAPI);
  server.on("/reset", handleReset);
  server.begin();
  Serial.println("HTTP server started");

  // UDP
  deviceId = String(ESP.getChipId(), HEX);
  udp.begin(DISCOVERY_PORT);
}

void loop() {
  server.handleClient();

  // ---- キャリブ：押下中 min/max 学習、離したら確定 ----
  bool btn = (digitalRead(CALIB_BUTTON_PIN) == LOW);
  static bool prevBtn = false;

  if (btn && !prevBtn) {
    calibHolding = true; calibrated = false;
    int cur = readA0Smooth();
    calibMin = cur; calibMax = cur;
  }
  if (btn && calibHolding) {
    int cur = readA0Smooth();
    if (cur < calibMin) calibMin = cur;
    if (cur > calibMax) calibMax = cur;
  }
  if (!btn && prevBtn) {
    calibHolding = false; calibrated = true;
    // 校正幅が極端に狭い場合の保護（±2以上にする）
    if (abs(calibMax - calibMin) < 2) {
      calibMin = 0; calibMax = 1023; calibrated = false;
    }
  }
  prevBtn = btn;

  // ---- 表示更新（50ms毎）----
  uint32_t now = millis();
  if (now - lastDispMs >= 50) {
    lastDispMs = now;
    int raw = readA0Smooth();
    if (calibrated) {
      int v = mapTo0_100(raw, calibMin, calibMax); // 0..100
      display.showNumberDec(v, false, 3, 1);       // 右3桁に表示
    } else {
      // 未キャリブ時は生A0（0..1023想定）
      int show = raw; if (show > 9999) show = 9999;
      display.showNumberDec(show, true);
    }
  }

  
  int len = udp.parsePacket();
  if (len > 0) {
    char buf[64]; int n = udp.read(buf, sizeof(buf)-1); buf[n] = 0;
    if (String(buf) == "DISCOVER_ENCODER") {
      String resp = "{\"type\":\"encoder\",\"id\":\"" + deviceId +
                    "\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
      udp.beginPacket(udp.remoteIP(), udp.remotePort());
      udp.write(resp.c_str());
      udp.endPacket();
    }
  }
}
