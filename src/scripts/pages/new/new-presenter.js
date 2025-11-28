export default class NewPresenter {
  #view;
  #model;

  constructor({ view, model }) {
    this.#view = view;
    this.#model = model;
  }

  async addNewStory({ description, photo, lat, lon }) {
    this.#view.showSubmitLoadingButton();
    try {
      const response = await this.#model.addNewStory({ description, photo, lat, lon });

      if (!response.ok) {
        console.error('addNewStory: response:', response);
        this.#view.storyAddedFailed(response.message);
        return;
      }

      this.#view.storyAddedSuccessfully('Cerita berhasil dibagikan!');
    } catch (error) {
      console.error('addNewStory: error:', error);
      this.#view.storyAddedFailed(error.message);
    } finally {
      this.#view.hideSubmitLoadingButton();
    }
  }
}
