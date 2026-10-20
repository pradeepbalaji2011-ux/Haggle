Piper TTS Setup for Haggle Assistant
=====================================

To enable offline voice output, download Piper TTS:

1. Download Piper for Windows:
   https://github.com/rhasspy/piper/releases
   → Download: piper_windows_amd64.zip
   
2. Extract and place piper.exe in this folder:
   tools/piper/piper.exe

3. Download the voice model (en_US-jenny-medium, ~45MB):
   https://huggingface.co/rhasspy/piper-voices/resolve/main/en_US/en_US-jenny-medium/medium/en_US-jenny-medium.onnx
   
4. Also download the config file:
   https://huggingface.co/rhasspy/piper-voices/resolve/main/en_US/en_US-jenny-medium/medium/en_US-jenny-medium.onnx.json

5. Place both files in this folder:
   tools/piper/en_US-jenny-medium.onnx
   tools/piper/en_US-jenny-medium.onnx.json

6. Test Piper:
   echo "Hello from Haggle" | .\piper.exe --model en_US-jenny-medium.onnx --output_file test.wav
   
Piper works 100% offline with no API keys needed.
If Piper is not set up, the browser's built-in speechSynthesis will be used automatically.
