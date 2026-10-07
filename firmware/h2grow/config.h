#pragma once

// Home Wi-Fi. The phone, the Mac, and the ESP32 all join this network.
// Leave the placeholder in place to start a setup hotspot named H2GROW instead.
#define WIFI_SSID "KULKARNI-JIO_2.4G"
#define WIFI_PASSWORD ""

// Shared with DEVICE_KEY in the Next.js .env.local file.
#define DEVICE_KEY "h2grow-local"

// The Mac can open http://h2grow.local/ once the board is on Wi-Fi.
#define MDNS_NAME "h2grow"

// DHT11 data pin. Power the sensor from 3V3, never from 5V.
#define DHT_PIN 4

// Relay IN pin. Power the relay coil from VIN / 5V.
// Most 1-channel modules turn ON when this pin is LOW.
#define RELAY_PIN 26
#define RELAY_ACTIVE_LOW 1
