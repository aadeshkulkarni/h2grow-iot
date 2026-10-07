# H2GROW setup

This project is a phone-first controller for an ESP32, a DHT11 temperature and humidity sensor, and a 5V 1-channel relay. The ESP32 reads the sensor and switches the relay. A Next.js app on your Mac shows the readings and the switch, after a 4-digit PIN.

The PIN is **7777** until you change it.

Windows steps are in [SETUP-WINDOWS.md](SETUP-WINDOWS.md).

## How the pieces connect

The USB cable is for flashing the firmware and for power. The app talks to the board over Wi-Fi.

```
Phone browser
    |
    |  http://<your-mac>:3000
    v
Next.js app on the Mac  ---- Wi-Fi ----  ESP32 ---- DHT11
                                          |
                                          +---- 5V relay
```

Your phone, your Mac, and the ESP32 join the same home Wi-Fi. The phone opens the app on the Mac. The Mac calls the ESP32.

## What you need

Hardware:

- ESP32 development board (the common 30-pin DevKit is assumed below)
- DHT11 sensor, preferably the 3-pin module
- 5V 1-channel relay module
- Female-to-female jumper wires
- A USB cable that carries data. A charge-only cable will power the board and still hide it from the Mac
- Optional: a 10kΩ resistor, only if the DHT11 is the bare 4-pin part

Software:

- [Arduino IDE 2](https://www.arduino.cc/en/software) for flashing the ESP32
- The ESP32 board package from Espressif, installed inside Arduino IDE
- The **DHT sensor library** by Adafruit, and **Adafruit Unified Sensor**
- [Node.js](https://nodejs.org/) 22 or newer to run the web app. Node 23 also runs it
- A browser on the Mac, and the same browser on your phone

## 1. Install the ESP32 tools

1. Install Arduino IDE 2 and open it.
2. Go to **Arduino IDE → Settings** (on macOS) and find **Additional boards manager URLs**. If it is empty, add:

   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

   Arduino IDE 2 often already knows this URL. Leave a URL that is already there.
3. Open **Tools → Board → Boards Manager**, search for `esp32`, and install **esp32 by Espressif Systems**.
4. Open **Sketch → Include Library → Manage Libraries** and install **DHT sensor library** by Adafruit. When it offers **Adafruit Unified Sensor**, install that too.

### USB port on a Mac

Plug the ESP32 into the Mac. In Terminal:

```bash
ls /dev/cu.usb*
```

You want a new port that appears only while the board is plugged in.

| Port name | What it means |
| --- | --- |
| `/dev/cu.usbserial-…` or `/dev/cu.SLAB_USBtoUART` | CP2102 USB chip. Install the [Silicon Labs CP210x driver](https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers) if the port never appears |
| `/dev/cu.wchusbserial…` | CH340 USB chip. Install the [WCH CH340 driver](https://www.wch-ic.com/downloads/CH34XSER_MAC_ZIP.html) if the port never appears |
| `/dev/cu.usbmodem…` | Native USB, common on ESP32-S3 boards. No extra driver |

In Arduino IDE, open **Tools → Port** and select that device.

Then open **Tools → Board → esp32**:

- Chip marked `ESP32-WROOM-32`: choose **ESP32 Dev Module**
- Chip marked `ESP32-S3`: choose **ESP32S3 Dev Module**

## 2. Wire the sensor and the relay

Unplug the ESP32 while you wire it. All three boards share ground.

```
ESP32 3V3  ---------------- DHT11 VCC
ESP32 GND  ---------------- DHT11 GND
ESP32 GPIO 4 -------------- DHT11 DATA

ESP32 VIN (5V from USB) --- Relay VCC
ESP32 GND  ---------------- Relay GND
ESP32 GPIO 26 ------------- Relay IN
```

On the usual blue DHT11 module the pins are `+`, `OUT`, and `-`. `OUT` is the data pin.

On a bare 4-pin DHT11, hold the grille toward you. From left to right the pins are **VCC, DATA, NC, GND**. Add a 10kΩ resistor between VCC and DATA. Leave NC unconnected.

Use the ESP32 pin marked **3V3** for the DHT11. The ESP32 data pins are 3.3V. A DHT11 powered from 5V can put 5V on the data pin and damage the board.

Use the ESP32 pin marked **VIN** or **5V** for the relay coil. That pin is about 5V while the board is on USB. The relay coil will not pull in reliably from 3V3. The 30-pin DevKit exposes **GPIO 26**. If your board has no GPIO 26 (some ESP32-S3 boards), set `RELAY_PIN` in `firmware/h2grow/config.h` to a free pin such as `16`, and move the wire.

Leave the yellow jumper on the relay module installed, between **VCC** and **JD-VCC**. That is the simple one-supply wiring.

The screw terminals on the relay (**COM**, **NO**, **NC**) are the switch itself. They are not powered by the ESP32. For a low-voltage load with its own supply, wire the supply and the load through **COM** and **NO** so the circuit closes when the app says On:

```
Supply +  ----  COM
NO        ----  Load +
Load -    ----  Supply -
```

Mains wiring is outside this guide. Keep the first load at low voltage.

A short click when the ESP32 powers on can happen before the pin is driven. The firmware then holds the relay off.

## 3. Flash the firmware

1. Open `firmware/h2grow/h2grow.ino` in Arduino IDE. The sketch folder must be named `h2grow`, which it already is. `config.h` sits next to the `.ino` file.
2. Edit `firmware/h2grow/config.h`:

   ```cpp
   #define WIFI_SSID "YOUR_WIFI_NAME"
   #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   ```

   Use the 2.4 GHz network. Most ESP32 boards cannot join 5 GHz Wi-Fi. If the password contains `"` or `\`, escape it with a backslash.
3. Confirm the board and port under **Tools**. Set **Upload Mode** to **UART0 / Hardware CDC** if that menu is present. Leave **USB CDC On Boot** as **Disabled** unless the port name is `usbmodem`.
4. Click **Upload**.

   If upload fails with a port error, hold the **BOOT** button as the upload starts, then release it. You can also set **Tools → Upload Speed** to **115200**. Close the Serial Monitor before uploading.
5. Open **Tools → Serial Monitor** and set the baud rate to **115200**.

A working board prints its IP address, then a line every two seconds:

```
Connected. IP address: 192.168.1.42
Address: http://h2grow.local/
T=24.0C  H=55.0%  relay=OFF  ip=192.168.1.42
```

Type `on` or `off` in the Serial Monitor and press return. The relay should click. Type `status` to print the latest reading.

You can leave the Wi-Fi name as `YOUR_WIFI_NAME` for this first upload. After the sketch is on the board, set the real network from the app (next section) while the ESP32 stays plugged into the Mac. The board stores that Wi-Fi itself and restarts onto it. You only upload the sketch again if you change pins or the program.

If the board has no Wi-Fi saved, it also starts a rescue network named **H2GROW**, password `h2grow7777`, at `http://192.168.4.1`.

## 4. Run the web app

From the project folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter **7777**.

The app is in **live** mode, so it asks the ESP32 for real readings. Until the board answers, the screen says it is waiting. Copy the address from the Serial Monitor into `.env.local`:

```
ESP32_MODE=live
ESP32_HOST=http://192.168.1.42
DEVICE_KEY=h2grow-local
```

`DEVICE_KEY` starts as `h2grow-local` in both `.env.local` and the sketch. The setup form keeps them matched. Restart `npm run dev` after you edit `.env.local` by hand.

`http://h2grow.local` works on the Mac when Bonjour can see the board. If it does not resolve, use the numeric IP from the Serial Monitor. macOS may ask to allow the terminal or Node to find devices on the local network. Allow it.

To click through the interface before the board is online, set `ESP32_MODE=mock` and restart. The screen is labeled **Preview** and shows sample readings.

Check the board directly:

```bash
curl -H "X-Device-Key: h2grow-local" http://h2grow.local/status
```

A healthy reply looks like:

```json
{"temperature":24.0,"humidity":55.0,"valid":true,"relay":false}
```

## Configure Wi-Fi from the app

Upload the sketch once, leave the ESP32 plugged into the Mac, and close the Arduino Serial Monitor so the USB port is free.

In the app, open **Setup**. Enter the 2.4 GHz Wi-Fi name and password, then choose **Save and restart**. The Mac sends the settings over USB. The board stores them and reboots onto that network. Later changes can go over Wi-Fi when the board is already online, and the board restarts the same way.

The browser cannot flash a blank ESP32 by itself. The first upload is still the Arduino IDE step above. After that, Wi-Fi and the device key are changed from the form, without compiling again.

If several USB serial devices are plugged in, the form asks which port to use.

## 5. Open it on your phone

The phone has to be on the same Wi-Fi as the Mac. Stop the dev server, then start it so other devices can connect:

```bash
npm run dev:lan
```

Find the Mac's address:

```bash
ipconfig getifaddr en0
```

On the phone, open `http://<that-address>:3000` and enter **7777**. Use the numeric address, for example `http://192.168.1.20:3000`. In Safari you can use **Share → Add to Home Screen** so it opens like an app.

If the phone cannot connect, allow incoming connections for Node in **System Settings → Network → Firewall**.

## Change the PIN

Edit `DEVICE_PIN` in `.env.local`. It must stay a 4-digit number. Restart the dev server. The firmware does not need to change. Five wrong attempts pause login for 30 seconds.

The login cookie lasts 14 days. **Lock** on the dashboard signs out.

## What the app calls on the ESP32

| Request | Purpose |
| --- | --- |
| `GET /status` | Temperature, humidity, and relay state |
| `POST /relay?on=1` | Turn the switch on |
| `POST /relay?on=0` | Turn the switch off |
| `GET /config` | Wi-Fi name currently saved on the board |
| `POST /config` | Save Wi-Fi settings and restart the board |

Both need the header `X-Device-Key`. The Next.js server adds it. The browser never talks to the ESP32 directly.

The DHT11 is read every 2 seconds. Its accuracy is about ±2°C and ±5% relative humidity, so treat the numbers as room conditions, not a lab instrument. Keep the sensor out of direct sun and away from the relay.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| No serial port | Try another cable and USB port. Install the CP210x or CH340 driver that matches the port name above |
| `dfu-util: No DFU capable USB device available` | The IDE is using the wrong upload method. Set **Tools → Upload Mode** to **UART0 / Hardware CDC**. If the chip is `ESP32-WROOM-32`, set **Tools → Board** to **ESP32 Dev Module** instead of an S3 board. Close the Serial Monitor, hold **BOOT**, and upload again |
| Upload fails | Hold **BOOT** during upload. Set upload speed to 115200. Close anything else using the port, including the Serial Monitor, then upload again |
| `DHT11 read failed` forever | Data wire on GPIO 4, sensor powered from 3V3, grounds tied together. A bare sensor needs the 10kΩ resistor. Swap the data and VCC wires if the module is unlabeled |
| Relay never clicks | IN on GPIO 26, VCC on VIN/5V, shared ground. In the Serial Monitor, type `on`. If the onboard LED is backwards from the app, set `RELAY_ACTIVE_LOW` to `0` in `config.h` and upload again |
| Board reboots when the relay clicks | The USB port is sagging under the coil. Use a powered USB hub, or power the relay VCC from a separate 5V supply and keep the grounds connected |
| App stays offline | Mac and ESP32 on the same 2.4 GHz network. `ESP32_HOST` matches the Serial Monitor IP. `DEVICE_KEY` matches on both sides. `ESP32_MODE=live` |
| `h2grow.local` fails | Use `http://192.168.x.x` from the Serial Monitor |
| Phone cannot open the app | Run `npm run dev:lan`, use the Mac's LAN address, and allow Node through the firewall |
| Setup says the USB port is busy | Close the Arduino Serial Monitor, then save again |
| Setup cannot find the board | Use a data cable, upload the sketch once, and keep the ESP32 plugged into the Mac |
| GPIO 26 does not exist on the header | Change `RELAY_PIN` and move the wire |

## Project map

```
src/app/page.tsx          The phone UI
src/app/api/login         PIN check
src/app/api/status        Readings, via the Mac
src/app/api/relay         Switch, via the Mac
src/app/api/board         Wi-Fi setup and board restart
firmware/h2grow           Sketch to upload
.env.local                PIN, ESP32 address, and device key
```
