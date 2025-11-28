import RegisterPresenter from './register-presenter';
import * as WorldStoryAPI from '../../../data/api';

export default class RegisterPage {
  #presenter = null;

  async render() {
    return `
      <section class="register-container">
        <article class="register-card">
          <div class="register-header">
            <img src="../images/logo.png" alt="WorldStory Logo" class="login-illustration">
            <h1 class="register__title">Bergabunglah dengan WorldStory</h1>
            <p class="register-subtitle">Buat akun Anda dan mulai petualangan cerita yang tak terlupakan!</p>
          </div>

          <div class="register-separator">
            <hr class="separator-line">
            <span>atau</span>
            <hr class="separator-line">
          </div>

          <form id="register-form" class="register-form fade-in">
            <div class="form-control">
              <label for="name-input" class="register-form__name-title">
                <i class="fas fa-user icon"></i> Nama Lengkap
              </label>
              <div class="register-form__title-container">
                <input id="name-input" type="text" name="name" placeholder="Masukkan nama lengkap Anda">
              </div>
            </div>
            <div class="form-control">
              <label for="email-input" class="register-form__email-title">
                <i class="fas fa-envelope icon"></i> Email
              </label>
              <div class="register-form__title-container">
                <input id="email-input" type="email" name="email" placeholder="Contoh: nama@email.com">
              </div>
            </div>
            <div class="form-control">
              <label for="password-input" class="register-form__password-title">
                <i class="fas fa-lock icon"></i> Password
              </label>
              <div class="register-form__title-container">
                <input 
                  id="password-input" 
                  type="password" 
                  name="password" 
                  placeholder="Masukkan password baru"
                  minlength="8"
                  required
                  pattern=".{8,}"
                  title="Password minimal 8 karakter"
                >
                <small class="register-form__password-hint">*Password minimal 8 karakter</small>
              </div>
            </div>
            <div class="form-buttons register-form__form-buttons">
              <div id="submit-button-container">
                <button class="btn btn-primary" type="submit">Daftar Akun</button>
              </div>
              <p class="register-form__already-have-account">Sudah punya akun? <a href="#/login" class="login-link">Masuk di sini</a></p>
            </div>
          </form>
        </article>
      </section>
    `;
  }

  async afterRender() {
    this.#presenter = new RegisterPresenter({
      view: this,
      model: WorldStoryAPI,
    });

    this.#setupForm();
  }

  #setupForm() {
    document.getElementById('register-form').addEventListener('submit', async (event) => {
      event.preventDefault();

      const data = {
        name: document.getElementById('name-input').value,
        email: document.getElementById('email-input').value,
        password: document.getElementById('password-input').value,
      };
      await this.#presenter.getRegistered(data);
    });
  }

  registeredSuccessfully(message) {
    
    const container = document.querySelector('.register-card');
    if (container) {
      
      const msg = document.createElement('div');
      msg.className = 'register-success-message fade-in';
      msg.setAttribute('role', 'status');
      msg.innerHTML = `
        <i class="fas fa-check-circle success-icon"></i>
        <strong>Berhasil!</strong>
        <div style="margin-top:6px;">${message || 'Akun berhasil dibuat. Anda akan diarahkan ke halaman masuk.'}</div>
      `;

      
      container.insertBefore(msg, container.firstChild);
      document.getElementById('register-form').style.display = 'none';
    }

    
    setTimeout(() => {
      location.hash = '/login';
    }, 1500);
  }

  registeredFailed(message) {
    alert(message);
  }

  showSubmitLoadingButton() {
    document.getElementById('submit-button-container').innerHTML = `
      <button class="btn btn-primary" type="submit" disabled>
        <i class="fas fa-spinner loader-button"></i> Mendaftarkan...
      </button>
    `;
  }

  hideSubmitLoadingButton() {
    document.getElementById('submit-button-container').innerHTML = `
      <button class="btn btn-primary" type="submit">Daftar Akun</button>
    `;
  }
}