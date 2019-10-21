# HAPCAN Programmer (search):
## Frame type 10B not implemented.
## Frame type 10D not implemented.
## Frame type 105 not implemented.
## Frame type 103 not implemented.
## Special frame ignored: AA10C1C450A8A0FFFFFFFF29A5
## Special frame ignored: AA10E16E7465726661636539A5
## Special frame ignored: AA10E142425F4C414E5F4957A5
## Special frame ignored: AA1061300003660001030412A5
## Special frame ignored: AA1041300003FF00000C54E3A5


# HAPCAN Programmer (open any module settings): Frame type 106 not implemented.


# HAPCAN Programmer (read EEPROM):
## Frame type 30 not implemented.
## Frame type 40 not implemented.
## Frame type 100 not implemented.


# HAPCAN Programmer (read FLASH Block):
## Frame type 308 not implemented.


# Read module Notes: FLASH 0x008000 … 0x0083FF.


# Read module Channel Name:
## FLASH 0x008400 … 0x00841F (channel 1)
## FLASH 0x008420 … 0x00843F (channel 2)
## FLASH 0x008440 … 0x00845F (channel 3)
## ...
## FLASH 0x0085E0 … 0x0085FF (channel 16)


# New module: LED controller (3.8.0)
Done.
## set LEDx softly to
## stop LEDx
## start LEDx
## set LEDx speed to


# New module: Open collector (3.9.0)


# New module: IR transmitter (3.5.0)


# PWM controller in thermostat module (3.1.3)


# Button: send „push” frame.


# Buttons/LEDs: change channels/states

from:

01_03 device
|
+--> buttons (channel)
|    +--> 1_closed (state)
|    +--> 1_enabled (state)
|    +--> 1_status (state)
|    +--> 2_closed (state)
|    +--> 2_enabled (state)
|    +--> 2_status (state)
|    +--> 3_closed (state)
|    +--> 3_enabled (state)
|    +--> 3_status (state)
|    ...
|
+--> leds (channel)
|    +--> 1_enabled (state)
|    +--> 1_on (state)
|    +--> 2_enabled (state)
|    +--> 2_on (state)
|    +--> 3_enabled (state)
|    +--> 3_on (state)
|    ...
|
...

to:

01_03 device
|
+--> button_1 (channel)
|    +--> closed (state)
|    +--> enabled (state)
|    +--> status (state)
|
+--> button_2 (channel)
|    +--> closed (state)
|    +--> enabled (state)
|    +--> status (state)
|
+--> button_3 (channel)
|    +--> closed (state)
|    +--> enabled (state)
|    +--> status (state)
|
...
+--> led_1 (channel)
|    +--> enabled (state)
|    +--> on (state)
|
+--> led_2 (channel)
|    +--> enabled (state)
|    +--> on (state)
|
+--> led_3 (channel)
|    +--> enabled (state)
|    +--> on (state)
|
...


# Change channels/states for Relays:

02_02 (device)
|
+--> relay_1 (channel)
|    +--> closed (state)
|
+--> relay_1 (channel)
|    +--> closed (state)
|
+--> relay_1 (channel)
|    +--> closed (state)
|
...

