# 基本
# import RPi.GPIO as GPIO
# import time
# GPIO.setmode(GPIO.BCM)

# LED = 17

# GPIO.setup(LED,GPIO.OUT)

# pwm = GPIO.PWM(LED,20)

# pwm.start(50)
# try:
#     while True:
#         for i in range(1, 20):
#             pwm.ChangeFrequency(i)
#             time.sleep(0.5)

# except KeyboardInterrupt:
#     GPIO.cleanup()


# 基本
# import RPi.GPIO as GPIO
# import time
# import math
# GPIO.setmode(GPIO.BCM)

# LED = 17

# GPIO.setup(LED,GPIO.OUT)

# pwm = GPIO.PWM(LED,100)
# pwm.start(100)
# try:
#     while True:
#         for i in range(100, 0,-1):
#             pwm.ChangeDutyCycle(math.log(i))
#             time.sleep(0.01)

# except KeyboardInterrupt:
#     GPIO.cleanup()



# duty比を制御1
# import RPi.GPIO as GPIO
# import time

# GPIO.setmode(GPIO.BCM)

# LED = 17

# GPIO.setup(LED, GPIO.OUT)

# pwm = GPIO.PWM(LED, 100)

# pwm.start(0)

# try:
#     while True:

#         pwm.ChangeDutyCycle(5)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(25)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(50)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(75)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(100)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(75)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(50)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(25)
#         time.sleep(0.5)

#         pwm.ChangeDutyCycle(5)
#         time.sleep(0.5)
# except KeyboardInterrupt:
#     pwm.stop()
#     GPIO.cleanup()

# duty比制御2(フェードイン、アウト)
# import RPi.GPIO as GPIO
# import time

# GPIO.setmode(GPIO.BCM)

# LED = 17

# GPIO.setup(LED, GPIO.OUT)

# pwm = GPIO.PWM(LED, 10)

# pwm.start(0)

# try:

#     while True:

#         for duty in range(101):
#             pwm.ChangeDutyCycle(duty)
#             time.sleep(0.025)

#         for duty in range(100, -1, -1):
#             pwm.ChangeDutyCycle(duty)
#             time.sleep(0.025)

# except KeyboardInterrupt:
#     pwm.stop()
#     GPIO.cleanup()

# 周波数制御(うるさい)
# import RPi.GPIO as GPIO
# import time

# LED = 17

# GPIO.setmode(GPIO.BCM)
# GPIO.setup(LED, GPIO.OUT)

# pwm = GPIO.PWM(LED, 10)

# pwm.start(50)

# try:
#     while True:
#         pass

# except KeyboardInterrupt:
#     pwm.stop()
#     GPIO.cleanup()

# タクトスイッチ(押すたびに明るさを上げる)
# import RPi.GPIO as GPIO
# import time

# LED = 17
# SW_POWER = 27
# SW_UP = 22
# SW_DOWN = 23

# levels = [262,294,330,349,392,440,494,523]
# index = 0
# prevPowerState = 0
# powerOn = False
# duty = 100

# GPIO.setmode(GPIO.BCM)

# GPIO.setup(LED,GPIO.OUT)
# GPIO.setup(SW_POWER,GPIO.IN,pull_up_down=GPIO.PUD_DOWN)
# GPIO.setup(SW_UP,GPIO.IN,pull_up_down=GPIO.PUD_DOWN)
# GPIO.setup(SW_DOWN,GPIO.IN,pull_up_down=GPIO.PUD_DOWN)

# pwm = GPIO.PWM(LED,100)
# pwm.start(0)

# try:
#     while True:

#         powerState = GPIO.input(SW_POWER)
#         if powerState == 1 and prevPowerState == 0:

#             powerOn = not powerOn
#             pwm.ChangeDutyCycle(100 if powerOn else 0)

#             time.sleep(0.3)

#         prevPowerState = powerState

#         if not powerOn:
#             continue

#         if GPIO.input(SW_UP) == 1:

#             index = index + 1
#             if index >=len(levels):index=len(levels)-1

#             pwm.ChangeDutyCycle(levels[index])

#             time.sleep(0.3)

#         if GPIO.input(SW_DOWN) == 1:

#             index = index-1
#             if index<0:index=0

#             pwm.ChangeDutyCycle(levels[index])

#             time.sleep(0.3)

#         # if GPIO.input(SW_UP) == 1:

#         #     duty = min(100, duty + 2)
#         #     pwm.ChangeDutyCycle(duty)
#         #     time.sleep(0.05)

#         # if GPIO.input(SW_DOWN) == 1:

#         #     duty = max(0, duty - 2)
#         #     pwm.ChangeDutyCycle(duty)
#         #     time.sleep(0.05)

# except KeyboardInterrupt:
#     pwm.stop()
#     GPIO.cleanup()


# タクトスイッチ(長押しで明るさを上げる)
# import RPi.GPIO as GPIO
# import time

# LED = 17
# SW = 27

# levels = [0,25,50,75,100]
# index = 0

# GPIO.setmode(GPIO.BCM)

# GPIO.setup(LED,GPIO.OUT)
# GPIO.setup(SW,GPIO.IN,pull_up_down=GPIO.PUD_DOWN)

# pwm = GPIO.PWM(LED,100)
# pwm.start(levels[index])

# try:
#     while True:

#         if GPIO.input(SW) == 1:

#             for dc in range(0,101):
#                 pwm.ChangeDutyCycle(dc)
#                 time.sleep(0.02)

#         else:
#             pwm.ChangeDutyCycle(0)

# except KeyboardInterrupt:
#     pwm.stop()
#     GPIO.cleanup()


import RPi.GPIO as GPIO
import time

SW = 27
BUZZER = 17
prevSwState = 0
playing = False
noteIndex = 0

GPIO.setmode(GPIO.BCM)
GPIO.setup(BUZZER, GPIO.OUT)
GPIO.setup(SW, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

pwm = GPIO.PWM(BUZZER, 262)

kirakiraboshi = [
    262,262,392,392,440,440,392,
    349,349,330,330,294,294,262,
    392,392,349,349,330,330,294,
    392,392,349,349,330,330,294,
    262,262,392,392,440,440,392,
    349,349,330,330,294,294,262
]

NOTE_LEN = 0.5   # 1音の長さ(秒)
noteStart = 0

try:
    while True:
        swState = GPIO.input(SW)
        if swState == 1 and prevSwState == 0:
            playing = not playing
            if playing:
                pwm.ChangeFrequency(kirakiraboshi[noteIndex])
                pwm.start(50)
                noteStart = time.time()
            else:
                pwm.stop()  # 一時停止(noteIndexは保持)
            time.sleep(0.2)  # チャタリング防止
        prevSwState = swState

        if playing and time.time() - noteStart >= NOTE_LEN:
            noteIndex = (noteIndex + 1) % len(kirakiraboshi)
            pwm.ChangeFrequency(kirakiraboshi[noteIndex])
            noteStart = time.time()

        time.sleep(0.01)
finally:
    pwm.stop()
    GPIO.cleanup()


# ブザー(サイレン)
# import RPi.GPIO as GPIO
# import time

# BZ = 17

# GPIO.setmode(GPIO.BCM)
# GPIO.setup(BZ,GPIO.OUT)

# pwm = GPIO.PWM(BZ,500)
# pwm.start(50)

# try:
#     while True:

#         for f in range(500,2000,20):
#             pwm.ChangeFrequency(f)
#             time.sleep(0.01)

#         for f in range(2000,500,-20):
#             pwm.ChangeFrequency(f)
#             time.sleep(0.01)

# except KeyboardInterrupt:
#     pwm.stop()
#     GPIO.cleanup()

# import RPi.GPIO as GPIO
# import time

# BZ = 17

# GPIO.setmode(GPIO.BCM)
# GPIO.setup(BZ, GPIO.OUT)

# notes = {
#     "D": 294,
#     "G": 392,
#     "A": 440,
#     "B": 494
# }

# melody = [
#     "B",
#     "G",
#     "D",
#     "G",
#     "A",
#     "D",
#     "D",
#     "A",
#     "B",
#     "A",
#     "D",
#     "G"
# ]

# pwm = GPIO.PWM(BZ, notes["B"])
# pwm.start(50)

# try:
#     while True:
#         for note in melody:
#             pwm.ChangeFrequency(notes[note])
#             time.sleep(0.35)
#         time.sleep(0.35)

# except KeyboardInterrupt:
#     print("\nStopped")

# finally:
#     pwm.stop()
#     GPIO.cleanup()