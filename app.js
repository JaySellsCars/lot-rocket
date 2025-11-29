    /* ----- Floating tool buttons (right side, stacked) ----- */

    .tool-launcher-column {
      position: fixed;
      /* align vertically with the top of the first cards */
      top: 118px;
      right: 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: flex-end;
      z-index: 60;
    }

    .tool-launcher-btn {
      /* SAME SIZE FOR ALL BUTTONS */
      width: 190px;
      height: 46px;

      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.75);
      padding: 0 16px;

      font-size: 11px;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.12em;

      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      cursor: pointer;

      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);

      transition:
        transform 0.16s ease-out,
        box-shadow 0.16s ease-out,
        background 0.16s ease-out,
        border-color 0.16s ease-out,
        color 0.16s ease-out;
    }

    [data-theme="dark"] .tool-launcher-btn {
      background: radial-gradient(
        circle at top left,
        rgba(15, 23, 42, 0.96),
        rgba(15, 23, 42, 0.9)
      );
      color: var(--text-dark);
      box-shadow: 0 16px 35px rgba(0, 0, 0, 0.9);
    }

    [data-theme="dark"] .tool-launcher-btn:hover {
      transform: translateY(-2px) scale(1.03);
      background: radial-gradient(
        circle at top left,
        rgba(30, 64, 175, 0.97),
        rgba(15, 23, 42, 0.96)
      );
      border-color: rgba(248, 113, 113, 0.95);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.95);
    }

    [data-theme="dark"] .tool-launcher-btn:active {
      transform: scale(0.97);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.8);
    }

    [data-theme="light"] .tool-launcher-btn {
      background: rgba(255, 255, 255, 0.96);
      color: var(--text-light);
      border: 1px solid rgba(148, 163, 184, 0.9);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.25);
    }

    [data-theme="light"] .tool-launcher-btn:hover {
      transform: translateY(-2px) scale(1.03);
      background: linear-gradient(135deg, #ffffff, #e5e7eb);
      border-color: rgba(248, 113, 113, 0.9);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.28);
    }

    [data-theme="light"] .tool-launcher-btn:active {
      transform: scale(0.97);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.2);
    }

    @media (max-width: 820px) {
      .tool-launcher-column {
        /* on small screens, dock them bottom-right */
        top: auto;
        bottom: 16px;
        right: 16px;
      }

      .tool-launcher-btn {
        width: 170px;
        height: 44px;
      }
    }
