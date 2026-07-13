/* ==========================================================================
   VINTEX GUEST HOUSE — room.js
   The Booking Controller.
   - Holds the room category data (this stands in for the Vintex PMS's
     inventory table).
   - Renders the masonry category grid and keeps prices in sync with the
     currency state owned by main.js.
   - Owns the ReservationModal: a slide-in ticket panel that, on submit,
     pushes a request onto the local "queue" a staff member would work
     from inside the real Vintex PMS.
   ========================================================================== */

const RoomController = (() => {
  /* Line-art SVG placeholders — one per room type, monochrome, matching
     the "structural, not decorative" brief. */
  const ART = {
    single: `<svg viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="30" y="55" width="110" height="40" stroke="black" stroke-width="1.4"/>
      <rect x="30" y="40" width="110" height="18" stroke="black" stroke-width="1.4"/>
      <rect x="30" y="30" width="22" height="16" stroke="black" stroke-width="1.4"/>
      <line x1="18" y1="95" x2="18" y2="60" stroke="black" stroke-width="1.4"/>
      <line x1="18" y1="60" x2="30" y2="60" stroke="black" stroke-width="1.4"/>
      <circle cx="180" cy="45" r="16" stroke="black" stroke-width="1.4"/>
      <line x1="167" y1="58" x2="150" y2="80" stroke="black" stroke-width="1.4"/>
      <line x1="193" y1="58" x2="205" y2="90" stroke="black" stroke-width="1.4"/>
    </svg>`,
    twin: `<svg viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="18" y="55" width="90" height="38" stroke="black" stroke-width="1.4"/>
      <rect x="18" y="42" width="90" height="16" stroke="black" stroke-width="1.4"/>
      <rect x="132" y="55" width="90" height="38" stroke="black" stroke-width="1.4"/>
      <rect x="132" y="42" width="90" height="16" stroke="black" stroke-width="1.4"/>
      <line x1="120" y1="35" x2="120" y2="93" stroke="black" stroke-width="1" stroke-dasharray="2 4"/>
    </svg>`,
    double: `<svg viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="30" y="50" width="150" height="42" stroke="black" stroke-width="1.4"/>
      <rect x="30" y="34" width="150" height="20" stroke="black" stroke-width="1.4"/>
      <line x1="105" y1="34" x2="105" y2="92" stroke="black" stroke-width="1"/>
      <rect x="16" y="42" width="18" height="52" stroke="black" stroke-width="1.4"/>
      <line x1="200" y1="45" x2="220" y2="45" stroke="black" stroke-width="1.4"/>
      <line x1="200" y1="55" x2="216" y2="55" stroke="black" stroke-width="1.4"/>
    </svg>`,
    family: `<svg viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="18" y="52" width="120" height="40" stroke="black" stroke-width="1.4"/>
      <rect x="18" y="38" width="120" height="18" stroke="black" stroke-width="1.4"/>
      <rect x="150" y="66" width="60" height="26" stroke="black" stroke-width="1.4"/>
      <rect x="150" y="56" width="60" height="12" stroke="black" stroke-width="1.4"/>
      <line x1="6" y1="92" x2="6" y2="60" stroke="black" stroke-width="1.4"/>
      <line x1="6" y1="60" x2="18" y2="60" stroke="black" stroke-width="1.4"/>
    </svg>`,
  };

  /* Room inventory — mirrors what would be pulled from the Vintex PMS. */
  const ROOMS = [
    {
      id: 'single',
      code: 'R-01',
      name: 'The Single',
      desc: 'A quiet corner room for the solo traveller passing through the corridor — one window, one desk, one clear view east.',
      capacity: 1,
      usd: 48,
      totalUnits: 6,
      availableUnits: 4,
      art: ART.single,
    },
    {
      id: 'twin',
      code: 'R-02',
      name: 'Twin / Queen',
      desc: 'Two low beds or one queen, made up to order. Built for companions travelling together toward Amboseli.',
      capacity: 2,
      usd: 68,
      totalUnits: 8,
      availableUnits: 2,
      art: ART.twin,
    },
    {
      id: 'double',
      code: 'R-03',
      name: 'The Double',
      desc: 'Our widest standard room — a full-size bed, a reading chair, and enough floor for a second bag by the door.',
      capacity: 2,
      usd: 82,
      totalUnits: 5,
      availableUnits: 1,
      art: ART.double,
    },
    {
      id: 'family',
      code: 'R-04',
      name: 'Family Suite',
      desc: 'A connecting layout for three to four — main bed, a second sleeping alcove, and a shared sitting space.',
      capacity: 4,
      usd: 124,
      totalUnits: 3,
      availableUnits: 0,
      art: ART.family,
    },
  ];

  const QUEUE_KEY = 'vintex_reservation_queue';

  function availabilityLabel(room) {
    if (room.availableUnits <= 0) return { text: 'Sold out', low: false, soldOut: true };
    if (room.availableUnits <= 2) return { text: `Only ${room.availableUnits} room${room.availableUnits === 1 ? '' : 's'} remaining`, low: true, soldOut: false };
    return { text: `${room.availableUnits} rooms available`, low: false, soldOut: false };
  }

  function getRoomById(id) {
    return ROOMS.find((r) => r.id === id);
  }

  /* ---------------------------------------------------------------- */
  /* GRID RENDER                                                       */
  /* ---------------------------------------------------------------- */
  function renderGrid(mountId) {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    mount.innerHTML = ROOMS.map((room) => {
      const avail = availabilityLabel(room);
      return `
        <article class="room-card fade-up" data-room-id="${room.id}">
          <div class="room-card__art">
            <span class="room-card__code">${room.code}</span>
            <span class="stamp ${avail.soldOut ? 'stamp--soldout' : ''}">${avail.soldOut ? 'Sold Out' : avail.low ? 'Limited' : 'Open'}</span>
            ${room.art}
          </div>
          <div class="room-card__body">
            <h3 class="room-card__name">${room.name}</h3>
            <p class="room-card__desc">${room.desc}</p>
            <div class="room-card__meta">
              <div class="room-card__price" data-price-for="${room.id}">
                ${Vintex.formatPrice(room.usd)}<br><small>${Vintex.formatPriceUnit()}</small>
              </div>
              <div class="room-card__avail ${avail.low ? 'is-low' : ''}" data-avail-for="${room.id}">${avail.text}</div>
            </div>
            <button
              class="btn room-card__cta"
              data-open-modal="${room.id}"
              ${avail.soldOut ? 'disabled' : ''}
            >${avail.soldOut ? 'Unavailable' : 'Request to Reserve'}</button>
          </div>
        </article>
      `;
    }).join('');

    // Real-time currency updates across the grid, no reload
    Vintex.onCurrencyChange(() => {
      ROOMS.forEach((room) => {
        const priceEl = mount.querySelector(`[data-price-for="${room.id}"]`);
        if (priceEl) {
          priceEl.innerHTML = `${Vintex.formatPrice(room.usd)}<br><small>${Vintex.formatPriceUnit()}</small>`;
        }
      });
    });

    mount.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', () => ReservationModal.open(btn.dataset.openModal));
    });
  }

  return { ROOMS, getRoomById, availabilityLabel, renderGrid, QUEUE_KEY };
})();

/* ============================================================================
   RESERVATION MODAL — slide-in ticket panel
   ============================================================================ */
const ReservationModal = (() => {
  let currentRoomId = null;
  let els = {};

  function mount() {
    if (document.getElementById('reservationModal')) return; // already mounted

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="scrim" id="modalScrim"></div>
      <aside class="modal" id="reservationModal" aria-hidden="true" aria-label="Reservation request">
        <div class="modal__header">
          <div>
            <div class="modal__eyebrow">Reservation Request &middot; <span id="modalCode"></span></div>
            <h3 class="modal__title" id="modalRoomName"></h3>
          </div>
          <button class="modal__close" id="modalClose" aria-label="Close">&times;</button>
        </div>

        <div class="ticket-rule"></div>

        <div class="modal__summary">
          <div>
            <span class="k">Rate</span>
            <span id="modalPrice"></span>
          </div>
          <div>
            <span class="k">Status</span>
            <span id="modalAvail"></span>
          </div>
        </div>

        <form class="modal__form" id="modalForm" novalidate>
          <div class="field">
            <label for="rf-name">Full name</label>
            <input id="rf-name" name="name" type="text" autocomplete="name" required />
          </div>
          <div class="field">
            <label for="rf-email">Email</label>
            <input id="rf-email" name="email" type="email" autocomplete="email" required />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="rf-checkin">Check-in</label>
              <input id="rf-checkin" name="checkin" type="date" required />
            </div>
            <div class="field">
              <label for="rf-checkout">Check-out</label>
              <input id="rf-checkout" name="checkout" type="date" required />
            </div>
          </div>
          <div class="field">
            <label for="rf-guests">Guests</label>
            <select id="rf-guests" name="guests" required></select>
          </div>
          <div class="field">
            <label for="rf-notes">Notes (optional)</label>
            <textarea id="rf-notes" name="notes" rows="3" placeholder="Arrival time, dietary notes, anything the front desk should know."></textarea>
          </div>

          <div class="modal__error" id="modalError"></div>

          <button type="submit" class="btn modal__submit" id="modalSubmitBtn">Submit Request</button>
        </form>

        <div class="modal__confirm" id="modalConfirm">
          <span class="stamp">Queued</span>
          <p>Your request has entered the Vintex reservation queue.</p>
          <div class="modal__confirm-ref" id="modalRef"></div>
          <p class="modal__confirm-note">A member of the Vintex team will confirm availability and send payment details by email, usually within one business day.</p>
          <button type="button" class="btn btn--ghost" id="modalDone" style="margin-top:24px;">Done</button>
        </div>
      </aside>
    `;
    document.body.appendChild(wrapper);

    els = {
      scrim: document.getElementById('modalScrim'),
      modal: document.getElementById('reservationModal'),
      close: document.getElementById('modalClose'),
      code: document.getElementById('modalCode'),
      roomName: document.getElementById('modalRoomName'),
      price: document.getElementById('modalPrice'),
      avail: document.getElementById('modalAvail'),
      form: document.getElementById('modalForm'),
      error: document.getElementById('modalError'),
      confirm: document.getElementById('modalConfirm'),
      ref: document.getElementById('modalRef'),
      done: document.getElementById('modalDone'),
      guests: document.getElementById('rf-guests'),
    };

    els.scrim.addEventListener('click', close);
    els.close.addEventListener('click', close);
    els.done.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.modal.classList.contains('is-open')) close();
    });
    els.form.addEventListener('submit', handleSubmit);

    Vintex.onCurrencyChange(() => {
      if (currentRoomId) refreshPriceAndAvail();
    });
  }

  function refreshPriceAndAvail() {
    const room = RoomController.getRoomById(currentRoomId);
    if (!room) return;
    els.price.textContent = `${Vintex.formatPrice(room.usd)} / night`;
    const avail = RoomController.availabilityLabel(room);
    els.avail.textContent = avail.text;
  }

  function populateGuestOptions(capacity) {
    els.guests.innerHTML = '';
    for (let i = 1; i <= capacity; i += 1) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i} guest${i > 1 ? 's' : ''}`;
      els.guests.appendChild(opt);
    }
  }

  function open(roomId) {
    mount();
    const room = RoomController.getRoomById(roomId);
    if (!room || room.availableUnits <= 0) return;

    currentRoomId = roomId;
    els.form.reset();
    els.form.style.display = 'flex';
    els.confirm.classList.remove('is-visible');
    els.error.classList.remove('is-visible');

    els.code.textContent = room.code;
    els.roomName.textContent = room.name;
    populateGuestOptions(room.capacity);
    refreshPriceAndAvail();

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('rf-checkin').min = today;
    document.getElementById('rf-checkout').min = today;

    els.scrim.classList.add('is-open');
    els.modal.classList.add('is-open');
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    window.setTimeout(() => document.getElementById('rf-name')?.focus(), 400);
  }

  function close() {
    els.scrim.classList.remove('is-open');
    els.modal.classList.remove('is-open');
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentRoomId = null;
  }

  function generateReference() {
    const stamp = Date.now().toString(36).toUpperCase().slice(-5);
    return `VTX-${stamp}`;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const data = new FormData(els.form);
    const checkin = data.get('checkin');
    const checkout = data.get('checkout');

    if (checkout && checkin && checkout <= checkin) {
      els.error.textContent = 'Check-out must be after check-in.';
      els.error.classList.add('is-visible');
      return;
    }
    els.error.classList.remove('is-visible');

    const room = RoomController.getRoomById(currentRoomId);
    const reference = generateReference();

    const entry = {
      reference,
      roomId: room.id,
      roomName: room.name,
      name: data.get('name'),
      email: data.get('email'),
      checkin,
      checkout,
      guests: data.get('guests'),
      notes: data.get('notes'),
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    // "Lands in a queue for Vintex staff" — simulated via local storage,
    // standing in for a POST to the Vintex PMS reservations endpoint.
    try {
      const queue = JSON.parse(localStorage.getItem(RoomController.QUEUE_KEY) || '[]');
      queue.push(entry);
      localStorage.setItem(RoomController.QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      /* storage unavailable — request still shown as confirmed to the guest */
    }

    els.form.style.display = 'none';
    els.ref.textContent = reference;
    els.confirm.classList.add('is-visible');
  }

  return { open, close };
})();