export default class HomePresenter {
  #view;
  #model;

  constructor({ view, model }) {
    this.#view = view;
    this.#model = model;
  }

  async initialGalleryAndMap() {
    this.#view.showLoading();
    this.#view.showMapLoading();
    try {
      const response = await this.#model.getAllStories();

      if (!response.ok) {
        console.error('initialGallery: response:', response);
        this.#view.populateReportsListError(response.message);
        return;
      }

      this.#view.populateReportsList(response.message, response.listStory || []);
      await this.#view.initialMap(response.listStory || []);
    } catch (error) {
      console.error('initialGallery: error:', error);
      this.#view.populateReportsListError(error.message);
    } finally {
      this.#view.hideLoading();
      this.#view.hideMapLoading();
    }
  }
}
