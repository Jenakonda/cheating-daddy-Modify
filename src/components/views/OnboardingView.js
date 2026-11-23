import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class OnboardingView extends LitElement {
    static styles = css`
        * {
            font-family: var(--font);
            cursor: default;
            user-select: none;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :host {
            display: block;
            height: 100%;
            width: 100%;
            position: fixed;
            top: 0;
            left: 0;
            overflow: hidden;
        }

        .onboarding {
            width: 100%;
            height: 100%;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            border: 1px solid var(--border-strong);
            overflow: hidden;
            background: var(--bg-app);
        }

        .top-strip {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 38px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0 var(--space-sm);
            -webkit-app-region: drag;
        }

        .close-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 26px;
            border: none;
            border-radius: var(--radius-sm);
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            -webkit-app-region: no-drag;
            transition:
                background var(--transition),
                color var(--transition);
        }

        .close-btn:hover {
            background: var(--danger);
            color: #ffffff;
        }

        .close-btn svg {
            width: 14px;
            height: 14px;
        }

        .slide {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            width: 100%;
            max-width: 440px;
            padding: var(--space-xl);
            gap: var(--space-md);
        }

        .brand-mark {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            border-radius: var(--radius-lg);
            background: var(--accent-soft);
            color: var(--accent);
            margin-bottom: var(--space-sm);
        }

        .brand-mark svg {
            width: 24px;
            height: 24px;
        }

        .slide-title {
            font-size: 24px;
            font-weight: var(--font-weight-medium);
            letter-spacing: -0.01em;
            color: var(--text-primary);
            line-height: 1.2;
        }

        .slide-text {
            font-size: var(--font-size-base);
            line-height: 1.5;
            color: var(--text-secondary);
            max-width: 360px;
        }

        .context-input {
            width: 100%;
            min-height: 140px;
            padding: 12px 14px;
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            background: var(--bg-surface);
            color: var(--text-primary);
            font-size: var(--font-size-sm);
            font-family: var(--font);
            line-height: 1.5;
            resize: vertical;
            text-align: left;
            user-select: text;
            cursor: text;
            transition:
                border-color var(--transition),
                box-shadow var(--transition);
        }

        .context-input::placeholder {
            color: var(--text-muted);
        }

        .context-input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-soft);
        }

        .actions {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-sm);
            margin-top: var(--space-sm);
        }

        .btn-primary {
            background: var(--btn-primary-bg, var(--text-primary));
            border: none;
            color: var(--btn-primary-text, var(--bg-app));
            padding: 10px 32px;
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            cursor: pointer;
            transition: background var(--transition);
        }

        .btn-primary:hover {
            background: var(--btn-primary-hover, #ffffff);
        }

        .btn-back {
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: var(--font-size-xs);
            cursor: pointer;
            padding: 4px 8px;
            transition: color var(--transition);
        }

        .btn-back:hover {
            color: var(--text-primary);
        }

        .steps {
            position: absolute;
            bottom: var(--space-lg);
            display: flex;
            gap: 6px;
        }

        .step {
            width: 6px;
            height: 4px;
            border-radius: 2px;
            background: var(--border-strong);
            transition:
                width var(--transition),
                background var(--transition);
        }

        .step.active {
            width: 18px;
            background: var(--accent);
        }
    `;

    static properties = {
        currentSlide: { type: Number },
        contextText: { type: String },
        onComplete: { type: Function },
        onClose: { type: Function },
    };

    constructor() {
        super();
        this.currentSlide = 0;
        this.contextText = '';
        this.onComplete = () => {};
        this.onClose = () => {};
    }

    handleContextInput(e) {
        this.contextText = e.target.value;
    }

    async completeOnboarding() {
        if (this.contextText.trim()) {
            await cheatingDaddy.storage.updatePreference('customPrompt', this.contextText.trim());
        }
        await cheatingDaddy.storage.updateConfig('onboarded', true);
        this.onComplete();
    }

    renderSlide() {
        if (this.currentSlide === 0) {
            return html`
                <div class="slide">
                    <div class="brand-mark">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M13 3v7h6l-8 11v-7H5z" />
                        </svg>
                    </div>
                    <div class="slide-title">Cheating Daddy</div>
                    <div class="slide-text">Real-time AI that listens, watches, and helps during interviews, meetings, and exams.</div>
                    <div class="actions">
                        <button
                            class="btn-primary"
                            @click=${() => {
                                this.currentSlide = 1;
                            }}
                        >
                            Continue
                        </button>
                    </div>
                </div>
            `;
        }

        return html`
            <div class="slide">
                <div class="slide-title">Add context</div>
                <div class="slide-text">Paste your resume or any info the AI should know. You can skip this and add it later.</div>
                <textarea
                    class="context-input"
                    placeholder="Resume, job description, notes..."
                    .value=${this.contextText}
                    @input=${this.handleContextInput}
                ></textarea>
                <div class="actions">
                    <button class="btn-primary" @click=${this.completeOnboarding}>Get started</button>
                    <button
                        class="btn-back"
                        @click=${() => {
                            this.currentSlide = 0;
                        }}
                    >
                        Back
                    </button>
                </div>
            </div>
        `;
    }

    render() {
        return html`
            <div class="onboarding">
                <div class="top-strip">
                    <button class="close-btn" @click=${() => this.onClose()} title="Close" aria-label="Close">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                ${this.renderSlide()}
                <div class="steps">
                    <span class="step ${this.currentSlide === 0 ? 'active' : ''}"></span>
                    <span class="step ${this.currentSlide === 1 ? 'active' : ''}"></span>
                </div>
            </div>
        `;
    }
}

customElements.define('onboarding-view', OnboardingView);
