import os
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL import Image, ImageEnhance