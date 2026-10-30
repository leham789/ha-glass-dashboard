import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HomeAssistant } from '../ha.js';

type OfferMessage =
  | { type: 'session'; session_id: string }
  | { type: 'answer'; answer: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }
  | { type: 'error'; code: string; message: string };

/**
 * A camera's live video, using what HA offers for it: WebRTC first (under a
 * second behind), else HLS where the browser plays it itself. Nothing shows
 * until the video is actually playing, so put a still picture underneath.
 * Fires `live-changed` (detail: true/false) as the video starts and stops.
 */
@customElement('glass-camera-live')
export class GlassCameraLive extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() entity = '';

  /** Bumped each start, so a slow answer for the previous camera is ignored. */
  private run = 0;
  private pc?: RTCPeerConnection;
  private unsubscribe?: Promise<() => Promise<void>>;

  protected updated(changed: PropertyValues): void {
    if (changed.has('entity') || (changed.has('hass') && !changed.get('hass'))) void this.start();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) void this.start();
  }

  disconnectedCallback(): void {
    this.stop();
    super.disconnectedCallback();
  }

  private get video(): HTMLVideoElement | null {
    return this.renderRoot.querySelector('video');
  }

  private async start() {
    this.stop();
    const run = ++this.run;
    const { hass, entity } = this;
    if (!hass || !entity) return;
    try {
      const caps = await hass.callWS<{ frontend_stream_types: string[] }>({ type: 'camera/capabilities', entity_id: entity });
      if (run !== this.run) return;
      if (caps.frontend_stream_types.includes('web_rtc') && hass.connection && 'RTCPeerConnection' in window) {
        await this.startWebRtc(hass, entity, run);
      } else if (caps.frontend_stream_types.includes('hls') && this.video?.canPlayType('application/vnd.apple.mpegurl')) {
        const { url } = await hass.callWS<{ url: string }>({ type: 'camera/stream', entity_id: entity });
        if (run === this.run && this.video) this.video.src = url;
      }
    } catch {
      // No live video: the still picture underneath stays.
    }
  }

  private async startWebRtc(hass: HomeAssistant, entity: string, run: number) {
    const { configuration } = await hass.callWS<{ configuration: RTCConfiguration }>({ type: 'camera/webrtc/get_client_config', entity_id: entity });
    if (run !== this.run) return;
    const pc = (this.pc = new RTCPeerConnection(configuration));
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    const stream = new MediaStream();
    pc.ontrack = (e) => {
      stream.addTrack(e.track);
      if (this.video && this.video.srcObject !== stream) this.video.srcObject = stream;
    };

    // Our network candidates go to HA once it has named the session.
    let session: string | undefined;
    const queued: RTCIceCandidateInit[] = [];
    const send = (candidate: RTCIceCandidateInit) =>
      hass.callWS({ type: 'camera/webrtc/candidate', entity_id: entity, session_id: session, candidate }).catch(() => undefined);
    pc.onicecandidate = (e) => {
      if (!e.candidate?.candidate) return;
      const c = e.candidate.toJSON();
      session ? send(c) : queued.push(c);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (run !== this.run) return;
    this.unsubscribe = hass.connection!.subscribeMessage<OfferMessage>(
      (msg) => {
        if (run !== this.run) return;
        if (msg.type === 'session') {
          session = msg.session_id;
          queued.splice(0).forEach(send);
        } else if (msg.type === 'answer') {
          pc.setRemoteDescription({ type: 'answer', sdp: msg.answer }).catch(() => this.stop());
        } else if (msg.type === 'candidate') {
          pc.addIceCandidate(msg.candidate).catch(() => undefined);
        } else if (msg.type === 'error') {
          this.stop();
        }
      },
      { type: 'camera/webrtc/offer', entity_id: entity, offer: offer.sdp },
    );
  }

  private stop() {
    this.run++;
    this.unsubscribe?.then((off) => off()).catch(() => undefined);
    this.unsubscribe = undefined;
    this.pc?.close();
    this.pc = undefined;
    const v = this.video;
    if (v) {
      v.srcObject = null;
      v.removeAttribute('src');
      v.load();
    }
    this.toggleAttribute('live', false);
    this.dispatchEvent(new CustomEvent('live-changed', { detail: false }));
  }

  private playing() {
    this.toggleAttribute('live', true);
    this.dispatchEvent(new CustomEvent('live-changed', { detail: true }));
  }

  render() {
    return html`<video muted autoplay playsinline disablepictureinpicture @playing=${this.playing}></video>`;
  }

  static styles = css`
    :host {
      display: block;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    :host([live]) {
      opacity: 1;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'glass-camera-live': GlassCameraLive;
  }
}
