import LoginPresenter from './login-presenter';
import * as WorldStoryAPI from '../../../data/api';
import * as AuthModel from '../../../utils/auth';

export default class LoginPage {
  #presenter = null;

  async render() {
    return `
      <section class="login-container">
        <article class="login-card">
          <!-- Ilustrasi Header -->
          <div class="login-header">
            <img src="../images/logo.png" alt="WorldStory Logo" class="login-illustration">
            <h1 class="login__title">Selamat Datang di WorldStory</h1>
            <p class="login-subtitle">Masuk ke akun Anda untuk melanjutkan petualangan cerita!</p>
          </div>

          <!-- Separator -->
          <div class="login-separator">
            <hr class="separator-line">
            <span>atau</span>
            <hr class="separator-line">
          </div>

          <!-- Form -->
          <form id="login-form" class="login-form fade-in">
            <div class="form-control">
              <label for="email-input" class="login-form__email-title">
                <i class="fas fa-envelope icon"></i> Email
              </label>
              <div class="login-form__title-container">
                <input 
                  id="email-input" 
                  type="email" 
                  name="email" 
                  placeholder="Contoh: nama@email.com"
                  required
                >
              </div>
            </div>
            <div class="form-control">
              <label for="password-input" class="login-form__password-title">
                <i class="fas fa-lock icon"></i> Password
              </label>
              <div class="login-form__title-container">
                <input 
                  id="password-input" 
                  type="password" 
                  name="password" 
                  placeholder="Masukkan password Anda"
                  required
                  minlength="8"
                >
              </div>
            </div>
            <div class="form-buttons login-form__form-buttons">
              <div id="submit-button-container">
                <button class="btn btn-primary" type="submit">Masuk</button>
              </div>
              <p class="login-form__do-not-have-account">Belum punya akun? <a href="#/register" class="register-link">Daftar di sini</a></p>
            </div>
          </form>
        </article>
      </section>
    `;
  }

  async afterRender() {
    this.#presenter = new LoginPresenter({
      view: this,
      model: WorldStoryAPI,
      authModel: AuthModel,
    });

    this.#setupForm();
  }

  #setupForm() {
    document.getElementById('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();

      const data = {
        email: document.getElementById('email-input').value,
        password: document.getElementById('password-input').value,
      };
      await this.#presenter.getLogin(data);
    });
  }

  loginSuccessfully(message) {
    console.log(message);

    // Redirect
    location.hash = '/';
  }

  loginFailed(message) {
    alert(message);
  }

  showSubmitLoadingButton() {
    document.getElementById('submit-button-container').innerHTML = `
      <button class="btn btn-primary" type="submit" disabled>
        <i class="fas fa-spinner loader-button"></i> Memproses...
      </button>
    `;
  }

  hideSubmitLoadingButton() {
    document.getElementById('submit-button-container').innerHTML = `
      <button class="btn btn-primary" type="submit">Masuk</button>
    `;
  }
}