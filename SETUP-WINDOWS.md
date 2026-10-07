# H2GROW setup on Windows

This project is a phone-first controller for an ESP32, a DHT11 temperature and humidity sensor, and a 5V 1-channel relay. The ESP32 reads the sensor and switches the relay. A Next.js app on your PC shows the readings and the switch, after a 4-digit PIN.

The PIN is **7777** until you change it.

Mac steps are in [SETUP.md](SETUP.md).

## How the pieces connect

The USB cable is for flashing the firmware and for power. The app talks to the board over Wi-Fi.

```
Phone browser
    |
    |  http://<your-pc>:3000
    v
Next.js app on the PC  ---- Wi-Fi ----  ESP32 ---- DHT11
                                        |
                                        +---- 5V relay
```

Your phone, your PC, and the ESP32 join the same home Wi-Fi. The phone opens the app on the PC. The PC calls the ESP32.

## What you need

Hardware:

- ESP32 development board (the common 30-pin DevKit is assumed below)
- DHT11 sensor, preferably the 3-pin module
- 5V 1-channel relay module
- Female-to-female jumper wires
- A USB cable that carries data. A charge-only cable will power the board and still hide it from Windows
- Optional: a 10kΩ resistor, only if the DHT11 is the bare 4-pin part

Software:

- [Arduino IDE 2](https://www.arduino.cc/en/software) for Windows
- The ESP32 board package from Espressif, installed inside Arduino IDE
- The **DHT sensor library** by Adafruit, and **Adafruit Unified Sensor**
- [Node.js](https://nodejs.org/) 22 LTS or newer. The Windows installer is enough. Node 23 also runs the app
- A browser on the PC, and a browser on your phone

Use **PowerShell** or **Windows Terminal** for the commands below. On Windows, `curl` in PowerShell is not the real curl. Use `curl.exe` when a step shows a curl command.

## 1. Install the ESP32 tools

1. Install Arduino IDE 2 and open it.
2. Go to **File → Preferences** and find **Additional boards manager URLs**. If it is empty, add:

   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

   Arduino IDE 2 often already knows this URL. Leave a URL that is already there.
3. Open **Tools → Board → Boards Manager**, search for `esp32`, and install **esp32 by Espressif Systems**.
4. Open **Sketch → Include Library → Manage Libraries** and install **DHT sensor library** by Adafruit. When it offers **Adafruit Unified Sensor**, install that too.

### USB port on Windows

Plug the ESP32 into the PC. Open **Device Manager** and expand **Ports (COM & LPT)**. You want a new COM port that appears only while the board is plugged in, for example **COM3** or **COM5**.

| Device Manager name | What it means |
| --- | --- |
| Silicon Labs CP210x USB to UART Bridge | CP2102 USB chip. Install the [Silicon Labs CP210x Windows driver](https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers) if it shows under **Other devices** with a warning icon |
| USB-SERIAL CH340 | CH340 USB chip. Install the [WCH CH340 driver](https://www.wch-ic.com/downloads/CH341SER_EXE.html) if the port never appears |
| USB Serial Device | Native USB, common on ESP32-S3 boards. Windows 10 and 11 already include this driver |

If the board is missing from **Ports** and sits under **Other devices**, the driver is not installed yet. Install the driver that matches the chip, then unplug the board and plug it back in.

In Arduino IDE, open **Tools → Port** and select that COM port. Do not pick a Bluetooth COM port.

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

Use the ESP32 pin marked **VIN** or **5V** for the relay coil. That pin is about 5V while the board is on USB. The relay coil will not pull in reliably from 3V3. The 30-pin DevKit exposes **GPIO 26**. If your board has no GPIO 26 (some ESP32-S3 boards), set `RELAY_PIN` in `firmware\h2grow\config.h` to a free pin such as `16`, and move the wire.

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

On Windows, put the Wi-Fi name in the sketch before this upload. The in-app USB setup path is for Mac. Once the board is on your network, later Wi-Fi changes can be sent from the app over Wi-Fi.

1. Open `firmware\h2grow\h2grow.ino` in Arduino IDE. The sketch folder must be named `h2grow`, which it already is. `config.h` sits next to the `.ino` file.
2. Edit `firmware\h2grow\config.h`:

   ```cpp
   #define WIFI_SSID "YOUR_WIFI_NAME"
   #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   ```

   Use the 2.4 GHz network. Most ESP32 boards cannot join 5 GHz Wi-Fi. If the password contains `"` or `\`, escape it with a backslash.
3. Confirm the board and COM port under **Tools**. Set **Upload Mode** to **UART0 / Hardware CDC** if that menu is present. Leave **USB CDC On Boot** as **Disabled** unless Device Manager calls the port a **USB Serial Device**.
4. Click **Upload**.

   If upload fails with a port error, hold the **BOOT** button as the upload starts, then release it. You can also set **Tools → Upload Speed** to **115200**. Close the Serial Monitor before uploading. Windows will refuse the COM port while another program has it open.
5. Open **Tools → Serial Monitor** and set the baud rate to **115200**.

A working board prints its IP address, then a line every two seconds:

```
Connected. IP address: 192.168.1.42
Address: http://h2grow.local/
T=24.0C  H=55.0%  relay=OFF  ip=192.168.1.42
```

Type `on` or `off` in the Serial Monitor and press return. The relay should click. Type `status` to print the latest reading.

If the board has no Wi-Fi saved, it starts a rescue network named **H2GROW**, password `h2grow7777`, at `http://192.168.4.1`. Prefer the home Wi-Fi name in `config.h` so the phone and the PC can stay on your normal network.

## 4. Run the web app

Open PowerShell in the project folder. In File Explorer you can Shift-right-click the folder and choose **Open in Terminal**.

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter **7777**.

The app is in **live** mode, so it asks the ESP32 for real readings. Until the board answers, the screen says it is waiting. Copy the address from the Serial Monitor into `.env.local` in the project folder. Create that file if it is not there:

```
DEVICE_PIN=7777
SESSION_SECRET=replace-with-a-long-random-string
ESP32_MODE=live
ESP32_HOST=http://192.168.1.42
DEVICE_KEY=h2grow-local
```

`DEVICE_KEY` starts as `h2grow-local` in both `.env.local` and the sketch. Keep them the same. Stop the dev server with Ctrl+C and run `npm run dev` again after you edit `.env.local`.

`http://h2grow.local` is unreliable on Windows. Use the numeric IP from the Serial Monitor.

To click through the interface before the board is online, set `ESP32_MODE=mock` and restart. The screen is labeled **Preview** and shows sample readings.

Check the board directly:

```powershell
curl.exe -H "X-Device-Key: h2grow-local" http://192.168.1.42/status
```

A healthy reply looks like:

```json
{"temperature":24.0,"humidity":55.0,"valid":true,"relay":false}
```

## Configure Wi-Fi from the app

After the board is already on your Wi-Fi, open **Setup** in the app. Enter the network name and password, then choose **Save and restart**. The PC sends the settings over Wi-Fi. The board stores them and reboots.

The first upload still happens in Arduino IDE. Put the Wi-Fi name in `config.h` for that upload. Sending settings over the USB cable from the Setup form is available on Mac, not on Windows.

The browser cannot flash a blank ESP32 by itself.

## 5. Open it on your phone

The phone has to be on the same Wi-Fi as the PC. Stop the dev server with Ctrl+C, then start it so other devices can connect:

```powershell
npm run dev:lan
```

Windows may ask whether Node.js can communicate on private networks. Choose **Allow**, and allow it on **Private** networks.

Find the PC's address:

```powershell
ipconfig
```

Use the **IPv4 Address** under **Wireless LAN adapter Wi-Fi**. It looks like `192.168.1.20`. Ignore addresses that start with `169.254`.

On the phone, open `http://<that-address>:3000` and enter **7777**. In Chrome you can use **Add to Home screen** so it opens like an app. In Safari on an iPhone, use **Share → Add to Home Screen**.

If the phone cannot connect:

1. Confirm the phone and PC are on the same Wi-Fi, not a guest network.
2. Open **Windows Security → Firewall & network protection → Allow an app through firewall**.
3. Allow **Node.js** on private networks. If it is missing, choose **Change settings → Allow another app**, then browse to the Node install, usually `C:\Program Files\nodejs\node.exe`.

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
| No COM port | Try another cable and USB port. In Device Manager, install the CP210x or CH340 driver if the board is under **Other devices** |
| `dfu-util: No DFU capable USB device available` | The IDE is using the wrong upload method. Set **Tools → Upload Mode** to **UART0 / Hardware CDC**. If the chip is `ESP32-WROOM-32`, set **Tools → Board** to **ESP32 Dev Module** instead of an S3 board. Close the Serial Monitor, hold **BOOT**, and upload again |
| Upload fails, port busy, or access denied | Close the Serial Monitor and any other serial app. Unplug the board, plug it back in, pick the new COM port, hold **BOOT**, and upload again. Set upload speed to **115200** |
| `DHT11 read failed` forever | Data wire on GPIO 4, sensor powered from 3V3, grounds tied together. A bare sensor needs the 10kΩ resistor. Swap the data and VCC wires if the module is unlabeled |
| Relay never clicks | IN on GPIO 26, VCC on VIN/5V, shared ground. In the Serial Monitor, type `on`. If the onboard LED is backwards from the app, set `RELAY_ACTIVE_LOW` to `0` in `config.h` and upload again |
| Board reboots when the relay clicks | The USB port is sagging under the coil. Use a powered USB hub, or power the relay VCC from a separate 5V supply and keep the grounds connected |
| App stays offline | PC and ESP32 on the same 2.4 GHz network. `ESP32_HOST` matches the Serial Monitor IP. `DEVICE_KEY` matches on both sides. `ESP32_MODE=live`. Restart `npm run dev` after editing `.env.local` |
| `h2grow.local` fails | Use `http://192.168.x.x` from the Serial Monitor |
| Phone cannot open the app | Run `npm run dev:lan`, use the PC's IPv4 address from `ipconfig`, and allow Node.js through the private-network firewall |
| Setup over USB does nothing | On Windows, put Wi-Fi in `config.h` and upload from Arduino IDE. The Setup form can update Wi-Fi later, once the board is already on the network |
| GPIO 26 does not exist on the header | Change `RELAY_PIN` in `config.h` and move the wire |

## Project map

```
src\app\page.tsx          The phone UI
src\app\api\login         PIN check
src\app\api\status        Readings, via the PC
src\app\api\relay         Switch, via the PC
src\app\api\board         Wi-Fi setup and board restart
firmware\h2grow           Sketch to upload
.env.local                PIN, ESP32 address, and device key
```
