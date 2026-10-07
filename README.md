# H2GROW

A mobile-first controller for an ESP32, a DHT11, and a 5V relay. The app unlocks with a 4-digit PIN, then shows temperature, humidity, and a switch.

- Mac setup: [SETUP.md](SETUP.md)
- Windows setup: [SETUP-WINDOWS.md](SETUP-WINDOWS.md)

## Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The PIN is `7777`.

On a Mac, after the sketch is uploaded once, **Setup** in the app can send Wi-Fi over USB and restart the board. On Windows, put the Wi-Fi name and password in `firmware/h2grow/config.h` before that first upload. After the board is on the network, **Setup** can update Wi-Fi over the network on either system.

To reach it from a phone on the same Wi-Fi:

```bash
npm run dev:lan
```

Then open `http://<your-computer-ip>:3000`.

- Mac: `ipconfig getifaddr en0`
- Windows PowerShell: `ipconfig`, then use the IPv4 address of the Wi-Fi adapter
