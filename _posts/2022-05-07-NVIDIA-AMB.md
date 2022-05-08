---
layout: post
title: NVIDIA AI Ambassador
author: jjunsss
date: 2022-05-07 20:20:00 +09:00
categories: [experience]
tags: [nvidia, ai, ambassador]
render_with_liquid: false
---
---
`NVIDIA Corp.
preliminary materials for Jetson AI Ambassador.`

<img src= "/assets/storage/nvidia/DLI_Certification.png" width = "150px" height="300px"  title = "nvidia certification" />

---

# **NVIDIA AI Ambassador**


## 😀this page is created to explain my project.😀

### called “Botline project” - Botline is our team name.

My project’s real name is “AI-Assisted Safety Systems Using Industrial Internet-of-Things(IIOT)” = “Botline project”

It was produced for the regional development contest. [ *x - corps contest* ] 

This project is a system for preventing accidents occurring in industrial sites and for faster logistical circulation. So we used a Jetbot for the application test.

[Total manual for Botline project is clicked here](https://www.notion.so/Jetbot-Manual-783ed3ab91a64e2c8d6c568ccc7d9cc3)

### **Draw a realization map**

![Total Map](/assets/storage/nvidia/Untitled.png)

### Testing video of all system

![Total_MTL-jetbot.gif](/assets/storage/nvidia/Total_MTL-jetbot.gif)

 Implemented The project “Botline project”

---

## My part of this project

1. **implemented Collision Avoidance + Road Following through JETBOT with jetson nano**
    - Jetson Nano Resources are not enough to implement two CNN algorithms at the same time. To solve this problem, The MTL(Multi-Tasking Learning) algorithm was developed.
    - MTL is Multi-Tasking Learning. There are two ways of MTL theory. ( 1. Hard Parameter Sharing / 2. Soft Parameter Sharing ). I chose the first method.
        - 
            
            ![my MTL model Diagram.](/assets/storage/nvidia/Untitled%201.png)
            
            my MTL model Diagram.
            
    
    - The shared Network included a Conv, BN, Activation Func, Linear, Dropout, etc
    - So our team solves resource problems through this algorithm
    - NEXT GIF shows original network vs MTL network performance
    
    ![Left: original Resnet-18 network
    Right: produced MTL network ](/assets/storage/nvidia/%EB%B9%84%EA%B5%90_%EB%AA%A8%EB%8D%B8.gif)
    
    Left: original Resnet-18 network
    Right: produced MTL network 
    
    - Training
        - Classifciation - used MSELoss
        - Regression - used BCELoss
        - Optimizer - Adam( LR = 0.001. else value is default. )
    
    ![Untitled](/assets/storage/nvidia/Untitled%202.png)
    

1. **Customed Yolov5 with Tensor RT for Object Detection in jetson Xavier**
    - Pre-selected obstacle images were trained in Yolov5
    - Applied various augmentation to obstacle images for improving detection performance
    - Applied Tensor RT to Yolov5 for a smooth frame in Jetson Xavier
    
2. **RTSP**
    - Real-Time Streaming Protocol by G-streamer
    - open-source protocol
    - It was used to transmit videos of Yolov5 in Xavier to the computer. ( for Profiling system. )
    
3. **The motion algorithm of each motor**


> Driving algorithm of Original Resnet-18 model ( Used in the past )
> 


```python
#코드의 가장 핵심인 execute 부분. change에 맞추어 값이 변화한다.

def execute(change):
    global angle_last, count, left, right
    image = change['new']
    xy = model_trt(preprocess(image)).detach().float().cpu().numpy().flatten()
    x = round(xy[0], 3)
    y = round((0.5 - xy[1]), 3)
    
    x_slider.value = x
    y_slider.value = y
    
    angle = round(np.arctan2(x, y),3) #radian
    
    if botLine.botLineObject.isStop is False:
        #gpio.output(7, gpio.HIGH)
        #gpio.output(11, gpio.LOW)
        
        if( y <= 0.001) and ( abs(x) <= 0.2 ) :
            count = count + 1
            left = max(left - (left * (count * 0.03)), 0)
            right = max(right - (right * (count * 0.03)), 0)

            if( count >= 15 ):
                robot.stop()
                left = 0
                right = 0

        else: # 장애물 x
            count = 0
            
            if ( (abs(angle - angle_last) > abs(angle_last)) and ( angle_last != 0) and (abs(angle) > pid_value.value)) :
                angle = angle_last + ( angle * diff_slider.value )
    
                pid = round(angle ,2)
                
                if pid > 0 :
                    left = round(pid * add_motor.value * speed_slider.value + speed_slider.value , 2)
                    right = round(-pid * dec_motor.value * speed_slider.value + speed_slider.value, 2)
                else:
                    left = round(pid * dec_motor.value * speed_slider.value + speed_slider.value , 2)
                    right = round(-pid * add_motor.value * speed_slider.value + speed_slider.value, 2)

                    
            else:
                pid = round(angle ,2) #0.95 etc..
                left = round(max(pid, 0)* add_motor.value * speed_slider.value + speed_slider.value , 2)
                right = round(max(-pid, 0)* add_motor.value * speed_slider.value + speed_slider.value, 2)

                
                speed_slider.value = speed_gain_slider.value
                steering_slider.value = pid

        #Global variables
        angle_last = angle
        robot.left_motor.value = left
        robot.right_motor.value = right
        
    else:
        robot.stop()

    botLine.onUpdate()    
execute({'new': camera.value})
```

> Driving Algorithm of MTL model ( present )
> 

```python
import time

angle_last = 0.0
left = 0.0
right = 0.0
isStop = False

t0 = time.time()

def execute(change):
    global angle_last, left, right, isStop, t0
    image = change['new']
    result = model(preprocess(image))
    xy = result[0].float().cpu().numpy().flatten()
    block = result[1].float().cpu().numpy().flatten()
    
    x = round(xy[0], 3)
    y = round((0.5 - xy[1]), 3)
    
    x_slider.value = x
    y_slider.value = y
    block_slider.value = block
    
    angle = round(np.arctan2(x, y),3) #radian
    
    if (botLine.botLineObject.isStop() is False) and (botLine.botLineObject.isWorking() is True):
        if block_slider.value >= 0.55:
            robot.stop()
            isStop = True
            left = 0
            right = 0
        else:
            if ( (abs(angle - angle_last) > abs(angle_last)) and ( angle_last != 0) and (abs(angle) > pid_value.value)):
                angle = angle_last + ( angle * diff_slider.value )

                pid = round(angle ,2)

                if pid > 0 :
                    left = round(pid * add_motor.value * speed_slider.value + speed_slider.value , 2)
                    right = round(-pid * dec_motor.value * speed_slider.value + speed_slider.value, 2)
                else:
                    left = round(pid * dec_motor.value * speed_slider.value + speed_slider.value , 2)
                    right = round(-pid * add_motor.value * speed_slider.value + speed_slider.value, 2)
            else:
                pid = round(angle ,2) #0.95 etc..
                left = round(max(pid, 0)* add_motor.value * speed_slider.value + speed_slider.value , 2)
                right = round(max(-pid, 0)* add_motor.value * speed_slider.value + speed_slider.value, 2)

                steering_slider.value = pid

                #전역변수 설정
            angle_last = angle
            robot.left_motor.value = left
            robot.right_motor.value = right
    else:
        robot.stop()
    
    image_data = image.copy()
    circle_color = (0, 255, 0)
    if block_slider.value >= 0.55:
        circle_color = (0, 0, 255)
    image_data = cv2.circle(image_data, 
                            (112 + int(x_slider.value * 112), 
                             224 - int(y_slider.value * 224)), 8, circle_color, 3)
    draw_widget.value = bgr8_to_jpeg(image_data)
    
    botLine.onUpdate()
    time.sleep(0.001)
        
execute({'new': camera.value})

```

1. **Preprocessing and Augmentation in images ( MTL, Yolov5 )** 
    - Resizing and Adjust Contrast
    - Adjust saturation, contrast, brightness, exposure,
    - Add gaussian noise
    - Grey_scale to Reduce the effect on brightness
    
    More  Augmentation and Preprocessing were applied to the original image and disappeared.
    

## Next plan

**Future plans for developing project**
- developing algorithm the management of swarm vehicles ( Master-Slaves position )
- Planning to change the network ( Resnet-18 ( MTL ) → EfficientNet ( MTL ) )
( EfficientNet was developed in 2020, It works well with fewer resources than Resnet-18 )
- Planning to change the collecting method the image data through the teacher-student method 

![a way improves ImageNet Classification performance](/assets/storage/nvidia/Untitled%203.png)

a way improves ImageNet Classification performance

### 👉 I will apply this way to my project for improving performance

for understanding this method, I Summarized that original paper

## List the applied techniques

- python, PyTorch
- Tensor RT
- RTSP ( Real-Time Streaming Protocol )
- private YOLOv5
- Client-Server Communication
- RoboFlow dataset