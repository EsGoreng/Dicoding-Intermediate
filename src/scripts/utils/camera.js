export default class Camera {
  #currentStream;
  #streaming = false;
  #width = 640;
  #height = 0;

  #videoElement;
  #selectCameraElement;
  #canvasElement;

  #takePictureButton;

  static addNewStream(stream) {
    if (!stream) {
      return;
    }

    if (!Array.isArray(window.currentStreams)) {
      window.currentStreams = [stream];
      return;
    }

    window.currentStreams = [...window.currentStreams, stream];
  }

  static stopAllStreams() {
    if (!Array.isArray(window.currentStreams)) {
      window.currentStreams = [];
      return;
    }

    window.currentStreams.forEach((stream) => {
      if (stream?.active) {
        stream.getTracks().forEach((track) => track.stop());
      }
    });
  }

  constructor({ video, cameraSelect, canvas, options = {} }) {
    this.#videoElement = video;
    this.#selectCameraElement = cameraSelect;
    this.#canvasElement = canvas;

    this.#initialListener();
  }

  #initialListener() {
    this.#videoElement.oncanplay = () => {
      if (this.#streaming) {
        return;
      }

      this.#height = (this.#videoElement.videoHeight * this.#width) / this.#videoElement.videoWidth;

      this.#canvasElement.setAttribute('width', this.#width);
      this.#canvasElement.setAttribute('height', this.#height);

      this.#streaming = true;
    };

    this.#selectCameraElement.onchange = async () => {
      await this.stop();
      await this.launch();
    };
  }

  async #populateDeviceList(stream) {
    try {
      if (!(stream instanceof MediaStream)) {
        return Promise.reject(Error('MediaStream not found!'));
      }

      const { deviceId } = stream.getVideoTracks()[0].getSettings();

      const enumeratedDevices = await navigator.mediaDevices.enumerateDevices();
      const list = enumeratedDevices.filter((device) => {
        return device.kind === 'videoinput';
      });

      const html = list.reduce((accumulator, device, currentIndex) => {
        return accumulator.concat(`
          <option
            value="${device.deviceId}"
            ${deviceId === device.deviceId ? 'selected' : ''}
          >
            ${device.label || `Camera ${currentIndex + 1}`}
          </option>
        `);
      }, '');

      this.#selectCameraElement.innerHTML = html;
    } catch (error) {
      console.error('#populateDeviceList: error:', error);
    }
  }

  async #getStream() {
    try {
      const deviceId =
        !this.#streaming && !this.#selectCameraElement.value
          ? undefined
          : { exact: this.#selectCameraElement.value };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          aspectRatio: 4 / 3,
          deviceId,
        },
      });

      await this.#populateDeviceList(stream);

      return stream;
    } catch (error) {
      console.error('#getStream: error:', error);
      return null;
    }
  }

  async launch() {
    this.#currentStream = await this.#getStream();

    if (!this.#currentStream) {
      console.warn('Gagal mendapatkan stream kamera, launch() dibatalkan.');
      return;
    }

    Camera.addNewStream(this.#currentStream);

    this.#videoElement.srcObject = this.#currentStream;
    this.#videoElement.play();

    this.#clearCanvas();
  }

  stop() {
    if (this.#videoElement) {
      this.#videoElement.srcObject = null;
      this.#streaming = false;
    }

    if (this.#currentStream instanceof MediaStream) {
      this.#currentStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    this.#clearCanvas();
  }

  #clearCanvas() {
    const context = this.#canvasElement.getContext('2d');
    context.fillStyle = '#AAAAAA';
    context.fillRect(0, 0, this.#canvasElement.width, this.#canvasElement.height);
  }

  async takePicture(mirrored = false, rotated = false) {
    if (!(this.#width && this.#height)) {
      return null;
    }

    const context = this.#canvasElement.getContext('2d');

    const width = this.#width;
    const height = this.#height;

    const isSwapped = rotated; 

    this.#canvasElement.width = isSwapped ? height : width;
    this.#canvasElement.height = isSwapped ? width : height;

    context.save();
    
    context.translate(this.#canvasElement.width / 2, this.#canvasElement.height / 2);

    if (mirrored) {
      context.scale(-1, 1);
    }
    if (rotated) {
      context.rotate(Math.PI / 2);
    }

    context.drawImage(this.#videoElement, -width / 2, -height / 2, width, height);

    context.restore(); 


    return await new Promise((resolve) => {
      this.#canvasElement.toBlob((blob) => resolve(blob));
    });
  }

  addCheeseButtonListener(selector, callback) {
    this.#takePictureButton = document.querySelector(selector);
    this.#takePictureButton.onclick = callback;
  }
}