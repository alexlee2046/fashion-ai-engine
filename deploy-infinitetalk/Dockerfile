# 使用官方 PyTorch 镜像作为基础
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel

# 设置工作目录
WORKDIR /app

# 安装系统依赖 (FFmpeg 是视频处理必选)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制 API 代码
COPY app.py .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "app.py"]
