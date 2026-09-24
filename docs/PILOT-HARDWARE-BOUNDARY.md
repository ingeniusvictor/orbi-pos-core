# Pilot hardware boundary

ORBI POS intentionally avoids a cashier-hardware recommendation until the El Chunchito workflow is better understood.

For the near-term Showcase pilot only, the minimum topology is:

~~~text
Existing shop LAN
      |
      +-- existing DIGI RM-60 (unchanged)
      |
      +-- ORBI host computer
      |      - Node.js
      |      - catalog sync
      |      - shared images
      |
      +-- TV display device
             - browser / Edge
             - /showcase
~~~

The ORBI host and TV device can be the same Windows mini-PC if the TV is connected by HDMI.

A Smart TV browser may also work, but a small Windows, ChromeOS or Android TV-capable device is operationally easier to control because browser kiosk behavior and automatic startup vary significantly between Smart TV manufacturers.

No dedicated touchscreen cashier terminal is required for the Showcase pilot.
