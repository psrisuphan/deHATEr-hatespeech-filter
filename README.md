# deHATEr

A browser extension designed to detect hate speech from messages on social media platforms. It utilizes a trained AI model called [4j3k](https://github.com/psrisuphan/4j3k).

**This is a group project for Artificial Intelligence.**

## Requirements

- The trained model “wangchanberta-hatespeech” is mandatory.
- Place the model in the directory `/deHATEr/models/`.

## Usage

### 1. (Optional) (Recommended) Environment Setup (only for the first run)
- Ensure Python 3.9 or higher is installed.
- Navigate to the `/deHATEr` directory using the terminal.
- Create and activate a virtual environment using the command: `python -m venv venv && source venv/bin/activate`.
- Install the dependencies using the command: `pip install -r requirements.txt`.

If you’re using Windows and want GPU acceleration, keep the optional `torch-directml` dependency. On other platforms, it’s safe to ignore it if the installation fails.

### 2. Run the API Server
- Navigate back to the main directory `/`.
- Host the API server using the terminal command: `./start_api_server.sh`.

### 3. Install the deHATEr Extension on Your Browser
- Open Chrome and go to `chrome://extensions`.
- Enable Developer Mode and click on “Load unpacked”.
- Choose the UIExtension folder (the one containing `manifest.json`). The extension should appear.

**Remember, the API server is required to be running while using the extension.**

## Model Credit

- L. Lowphansirikul, C. Polpanumas, N. Jantrakulchai, and S. Nutanong, “WangchanBERTa: Pretraining transformer-based Thai language models,” arXiv preprint arXiv:2101.09635, 2021. [Online]. Available: https://arxiv.org/abs/2101.09635.
- ForJustice3K, “4j3k: pretrained model for hatespeech detection”, 2025. [Online]. Available: https://github.com/psrisuphan/4j3k.
