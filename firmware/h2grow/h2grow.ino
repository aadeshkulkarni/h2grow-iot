#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <DHT.h>
#include "config.h"

DHT dht(DHT_PIN, DHT11);
WebServer server(80);
Preferences prefs;

String wifiSsid;
String wifiPassword;
String deviceKey;

float temperature = NAN;
float humidity = NAN;
bool readingValid = false;
bool relayOn = false;
bool usingAccessPoint = false;
int sensorFailures = 0;
unsigned long lastReadMs = 0;
unsigned long lastWifiCheckMs = 0;

String jsonEscape(const String &value) {
  String out;
  for (unsigned int i = 0; i < value.length(); i++) {
    char c = value.charAt(i);
    if (c == '"' || c == '\\') out += '\\';
    out += c;
  }
  return out;
}

bool readJsonString(const String &body, const char *key, String &out) {
  String pattern = String("\"") + key + "\"";
  int keyPos = body.indexOf(pattern);
  if (keyPos < 0) return false;
  int colon = body.indexOf(':', keyPos + pattern.length());
  if (colon < 0) return false;
  int quote = body.indexOf('"', colon + 1);
  if (quote < 0) return false;

  String value;
  for (int i = quote + 1; i < body.length(); i++) {
    char c = body.charAt(i);
    if (c == '\\' && i + 1 < body.length()) {
      char next = body.charAt(i + 1);
      if (next == '"' || next == '\\') {
        value += next;
        i++;
        continue;
      }
    }
    if (c == '"') {
      out = value;
      return true;
    }
    value += c;
  }
  return false;
}

void loadConfig() {
  prefs.begin("h2grow", true);
  wifiSsid = prefs.getString("ssid", WIFI_SSID);
  wifiPassword = prefs.getString("pass", WIFI_PASSWORD);
  deviceKey = prefs.getString("key", DEVICE_KEY);
  prefs.end();
}

bool storeSettings(String ssid, String pass, String key) {
  ssid.trim();
  key.trim();
  if (ssid.length() == 0 || ssid.length() > 32) return false;
  if (pass.length() > 63) return false;
  if (key.length() == 0 || key.length() > 64) return false;
  if (pass.length() == 0) pass = wifiPassword;

  prefs.begin("h2grow", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.putString("key", key);
  prefs.end();

  wifiSsid = ssid;
  wifiPassword = pass;
  deviceKey = key;
  return true;
}

void restartBoard() {
  Serial.println("CFG_OK");
  Serial.flush();
  delay(250);
  ESP.restart();
}

void setRelay(bool on) {
  relayOn = on;
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  } else {
    digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  }
  Serial.print("Relay ");
  Serial.println(on ? "ON" : "OFF");
}

bool authorized() {
  if (deviceKey.length() == 0) return true;
  String provided = server.header("X-Device-Key");
  if (provided.length() == 0) provided = server.header("x-device-key");
  return provided.equals(deviceKey);
}

void sendJson(int code, const String &body) {
  server.send(code, "application/json", body);
}

String statusJson() {
  String body = "{";
  if (readingValid) {
    body += "\"temperature\":";
    body += String(temperature, 1);
    body += ",\"humidity\":";
    body += String(humidity, 1);
    body += ",\"valid\":true";
  } else {
    body += "\"temperature\":null,\"humidity\":null,\"valid\":false";
  }
  body += ",\"relay\":";
  body += relayOn ? "true" : "false";
  body += "}";
  return body;
}

void handleStatus() {
  if (!authorized()) {
    sendJson(401, "{\"error\":\"unauthorized\"}");
    return;
  }
  sendJson(200, statusJson());
}

void handleRelay() {
  if (!authorized()) {
    sendJson(401, "{\"error\":\"unauthorized\"}");
    return;
  }

  bool on = relayOn;
  if (server.hasArg("on")) {
    String value = server.arg("on");
    value.toLowerCase();
    on = value == "1" || value == "true";
  } else if (server.hasArg("plain")) {
    String body = server.arg("plain");
    body.toLowerCase();
    if (body.indexOf("\"on\"") < 0) {
      sendJson(400, "{\"error\":\"expected on\"}");
      return;
    }
    on = body.indexOf("true") >= 0;
  } else {
    sendJson(400, "{\"error\":\"expected on\"}");
    return;
  }

  setRelay(on);
  sendJson(200, statusJson());
}

String postedField(const char *name) {
  if (server.hasArg(name)) return server.arg(name);
  if (!server.hasArg("plain")) return "";
  String value;
  if (readJsonString(server.arg("plain"), name, value)) return value;
  return "";
}

void handleConfigGet() {
  if (!authorized()) {
    sendJson(401, "{\"error\":\"unauthorized\"}");
    return;
  }
  String body = "{\"ssid\":\"";
  body += jsonEscape(wifiSsid);
  body += "\",\"passwordSet\":";
  body += wifiPassword.length() > 0 ? "true" : "false";
  body += ",\"key\":\"";
  body += jsonEscape(deviceKey);
  body += "\"}";
  sendJson(200, body);
}

void handleConfigPost() {
  if (!authorized()) {
    sendJson(401, "{\"error\":\"unauthorized\"}");
    return;
  }
  if (!storeSettings(postedField("ssid"), postedField("password"), postedField("key"))) {
    sendJson(400, "{\"error\":\"invalid settings\"}");
    return;
  }
  sendJson(200, "{\"ok\":true,\"restarting\":true}");
  restartBoard();
}

void handleRoot() {
  server.send(200, "text/plain", "H2GROW is running.\n");
}

void readSensor() {
  float nextHumidity = dht.readHumidity();
  float nextTemperature = dht.readTemperature();
  if (isnan(nextHumidity) || isnan(nextTemperature)) {
    sensorFailures += 1;
    if (sensorFailures >= 3) readingValid = false;
    Serial.println("DHT11 read failed");
    return;
  }

  sensorFailures = 0;
  humidity = nextHumidity;
  temperature = nextTemperature;
  readingValid = true;
}

void printStatus() {
  Serial.print("T=");
  if (readingValid) {
    Serial.print(temperature, 1);
    Serial.print("C  H=");
    Serial.print(humidity, 1);
    Serial.print("%");
  } else {
    Serial.print("--  H=--");
  }
  Serial.print("  relay=");
  Serial.print(relayOn ? "ON" : "OFF");
  Serial.print("  ip=");
  Serial.println(usingAccessPoint ? WiFi.softAPIP() : WiFi.localIP());
}

void handleSerial() {
  static String line;
  while (Serial.available()) {
    char next = Serial.read();
    if (next == '\n' || next == '\r') {
      line.trim();
      if (line.startsWith("CFG ")) {
        String json = line.substring(4);
        String ssid;
        String pass;
        String key;
        bool hasSsid = readJsonString(json, "ssid", ssid);
        bool hasKey = readJsonString(json, "key", key);
        readJsonString(json, "password", pass);
        if (hasSsid && hasKey && storeSettings(ssid, pass, key)) restartBoard();
        else Serial.println("CFG_ERR");
      } else {
        line.toLowerCase();
        if (line == "on") setRelay(true);
        else if (line == "off") setRelay(false);
        else if (line == "status") printStatus();
      }
      line = "";
    } else if (line.length() < 400) {
      line += next;
    } else {
      line = "";
    }
  }
}

bool startStation() {
  if (wifiSsid.length() == 0 || wifiSsid == "YOUR_WIFI_NAME") return false;

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setHostname(MDNS_NAME);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  Serial.print("Joining Wi-Fi");

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

void startAccessPoint() {
  usingAccessPoint = true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("H2GROW", "h2grow7777");
  Serial.println("Home Wi-Fi was not configured, so the board started its own network.");
  Serial.println("Join Wi-Fi network H2GROW");
  Serial.println("Password: h2grow7777");
  Serial.print("Then open http://");
  Serial.println(WiFi.softAPIP());
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);

  Serial.begin(115200);
  delay(300);
  loadConfig();
  setRelay(false);

  Serial.println();
  Serial.println("H2GROW");
  Serial.print("Wi-Fi name: ");
  Serial.println(wifiSsid);
  Serial.print("DHT11 on GPIO ");
  Serial.println(DHT_PIN);
  Serial.print("Relay on GPIO ");
  Serial.print(RELAY_PIN);
  Serial.println(RELAY_ACTIVE_LOW ? " (active LOW)" : " (active HIGH)");

  dht.begin();

  if (startStation()) {
    Serial.print("Connected. IP address: ");
    Serial.println(WiFi.localIP());
    if (MDNS.begin(MDNS_NAME)) {
      MDNS.addService("http", "tcp", 80);
      Serial.print("Address: http://");
      Serial.print(MDNS_NAME);
      Serial.println(".local/");
    }
  } else {
    startAccessPoint();
  }

  const char *headerKeys[] = {"X-Device-Key", "x-device-key"};
  server.collectHeaders(headerKeys, 2);
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/relay", HTTP_POST, handleRelay);
  server.on("/config", HTTP_GET, handleConfigGet);
  server.on("/config", HTTP_POST, handleConfigPost);
  server.begin();
  Serial.println("HTTP server is ready.");
}

void loop() {
  server.handleClient();
  handleSerial();

  unsigned long now = millis();
  if (now - lastReadMs >= 2000) {
    lastReadMs = now;
    readSensor();
    printStatus();
  }

  if (!usingAccessPoint && now - lastWifiCheckMs >= 10000) {
    lastWifiCheckMs = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Wi-Fi dropped. Rejoining.");
      WiFi.reconnect();
    }
  }
}
