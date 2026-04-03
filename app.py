import os
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL import Image, ImageEnhance
import cv2
import io
import base64

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
# ─── Model Paths (Zhang et al. Colorization) ─────────────────────────────────
MODEL_DIR  = 'models'
PROTOTXT   = os.path.join(MODEL_DIR, 'colorization_deploy_v2.prototxt')
CAFFEMODEL = os.path.join(MODEL_DIR, 'colorization_release_v2.caffemodel')
KERNEL_NPY = os.path.join(MODEL_DIR, 'pts_in_hull.npy')

colorization_net = None