const form = document.getElementById('tts-form');
const submitBtn = document.getElementById('submit-btn');
const statusCard = document.getElementById('status-card');
const statusLog = document.getElementById('status-log');
const resultCard = document.getElementById('result-card');
const audioEl = document.getElementById('result-audio');
const downloadLink = document.getElementById('download-link');
const rawResponse = document.getElementById('raw-response');

const conferenceForm = document.getElementById('conference-form');
const conferenceSubmit = document.getElementById('conference-submit');
const durationForm = document.getElementById('duration-form');
const durationSubmit = document.getElementById('duration-submit');
const speakerForm = document.getElementById('speaker-form');
const speakerSubmit = document.getElementById('speaker-submit');
const podcastForm = document.getElementById('podcast-form');
const podcastSubmit = document.getElementById('podcast-submit');

const conferenceResultCard = document.getElementById('conference-result-card');
const confSpeakerCount = document.getElementById('conf-speaker-count');
const confDuration = document.getElementById('conf-duration');
const confProgress = document.getElementById('conf-progress');
const confStatusDetail = document.getElementById('conf-status-detail');
const confSpeaker1 = document.getElementById('conf-speaker1');
const confSpeaker2 = document.getElementById('conf-speaker2');
const confSpeaker3 = document.getElementById('conf-speaker3');
const confSpeaker4 = document.getElementById('conf-speaker4');
const conferenceAudio = document.getElementById('conference-audio');
const conferenceAudioActions = document.getElementById('conference-audio-actions');
const conferenceDownload = document.getElementById('conference-download');
const confScriptEl = document.getElementById('conf-script');
const confLogEl = document.getElementById('conf-log');

const DEFAULT_SAMPLE =
  'https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav';

function buildHeaders(tokenLike) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (typeof tokenLike === 'string' && tokenLike.trim().length > 0) {
    headers.Authorization = `Bearer ${tokenLike.trim()}`;
  }
  return headers;
}

function logStatus(message) {
  statusCard.hidden = false;
  const entry = document.createElement('p');
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  statusLog.appendChild(entry);
  statusLog.scrollTop = statusLog.scrollHeight;
}

async function fileToGradioData(file) {
  if (!file) return null;
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    path: base64,
    url: null,
    size: file.size,
    orig_name: file.name,
    mime_type: file.type || 'audio/wav',
    meta: { _type: 'gradio.FileData' },
  };
}

function remoteToGradioData(url) {
  if (!url) return null;
  return {
    path: url,
    url,
    size: null,
    orig_name: url.split('/').pop() || 'voice-sample',
    mime_type: 'audio/wav',
    meta: { _type: 'gradio.FileData' },
  };
}

function combineApiUrl(base, endpoint) {
  if (typeof base !== 'string' || base.trim().length === 0) {
    throw new Error('API base URL is required.');
  }
  const trimmed = base.trim().replace(/\/$/, '');
  if (!endpoint) {
    return trimmed;
  }
  return `${trimmed}/${endpoint}`;
}

async function buildVoicePayload(formData) {
  const voiceInputs = [
    { file: formData.get('speaker1'), url: formData.get('speaker1Url') },
    { file: formData.get('speaker2'), url: formData.get('speaker2Url') },
    { file: formData.get('speaker3'), url: formData.get('speaker3Url') },
    { file: formData.get('speaker4'), url: formData.get('speaker4Url') },
  ];

  const processed = [];
  for (const { file, url } of voiceInputs) {
    const providedUrl = typeof url === 'string' && url.trim().length > 0 ? url.trim() : '';
    if (providedUrl) {
      processed.push(remoteToGradioData(providedUrl));
      continue;
    }
    if (file instanceof File && file.size > 0) {
      processed.push(await fileToGradioData(file));
      continue;
    }
    processed.push(remoteToGradioData(DEFAULT_SAMPLE));
  }
  return processed;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

async function requestGeneration(payload, apiUrl, headers) {
  logStatus('Submitting generation request…');
  const initial = await fetchJson(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: payload }),
  });

  const eventId =
    initial?.event_id ||
    initial?.eventId ||
    initial?.id ||
    (Array.isArray(initial) ? initial[0] : undefined);

  if (!eventId) {
    throw new Error(`Could not determine event_id from response: ${JSON.stringify(initial)}`);
  }

  logStatus(`Event ID received: ${eventId}`);
  return { eventId, initial };
}

async function pollForResult(apiUrl, eventId, headers) {
  const base = apiUrl.replace(/\/$/, '');
  const pollUrl = `${base}/${eventId}`;

  logStatus('Polling for completion…');
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const result = await fetchJson(pollUrl, { headers });
    const status = result?.status || result?.stage || 'UNKNOWN';
    logStatus(`Status: ${status}`);

    if (status === 'COMPLETE' || status === 'FINISHED' || status === 'SUCCESS') {
      return result;
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`Generation failed: ${JSON.stringify(result)}`);
    }
  }
}

function presentTtsResult(result) {
  resultCard.hidden = false;
  rawResponse.textContent = JSON.stringify(result, null, 2);

  const first = Array.isArray(result?.data) ? result.data[0] : null;
  const audioUrl = first?.url || first?.path || first?.data || null;
  if (typeof audioUrl === 'string') {
    audioEl.src = audioUrl;
    downloadLink.href = audioUrl;
    logStatus('Audio result ready.');
  } else {
    audioEl.removeAttribute('src');
    downloadLink.removeAttribute('href');
    logStatus('No audio URL found in response.');
  }
}

function resetConferenceOutputs() {
  if (conferenceResultCard) {
    conferenceResultCard.hidden = false;
  }
  if (confSpeakerCount) confSpeakerCount.textContent = '—';
  if (confDuration) confDuration.textContent = '—';
  if (confProgress) confProgress.textContent = '—';
  if (confStatusDetail) confStatusDetail.textContent = '—';
  if (confSpeaker1) confSpeaker1.textContent = '—';
  if (confSpeaker2) confSpeaker2.textContent = '—';
  if (confSpeaker3) confSpeaker3.textContent = '—';
  if (confSpeaker4) confSpeaker4.textContent = '—';
  if (conferenceAudio) {
    conferenceAudio.pause();
    conferenceAudio.hidden = true;
    conferenceAudio.removeAttribute('src');
    conferenceAudio.load();
  }
  if (conferenceAudioActions) {
    conferenceAudioActions.hidden = true;
  }
  if (conferenceDownload) {
    conferenceDownload.removeAttribute('href');
  }
  if (confScriptEl) confScriptEl.textContent = '';
  if (confLogEl) {
    confLogEl.textContent = '';
    confLogEl.hidden = true;
  }
}

function extractAudioSource(part) {
  if (!part) return null;
  if (typeof part === 'string') {
    return part;
  }
  if (typeof part === 'object') {
    if (part.url && typeof part.url === 'string') {
      return part.url;
    }
    if (part.path && typeof part.path === 'string') {
      if (/^data:/.test(part.path) || /^https?:/.test(part.path)) {
        return part.path;
      }
    }
    if (part.data && typeof part.data === 'string') {
      if (/^data:/.test(part.data) || /^https?:/.test(part.data)) {
        return part.data;
      }
      const mime = typeof part.mime_type === 'string' && part.mime_type.length > 0 ? part.mime_type : 'audio/wav';
      return `data:${mime};base64,${part.data}`;
    }
  }
  return null;
}

function updateSpeakerNames(names = []) {
  const targets = [confSpeaker1, confSpeaker2, confSpeaker3, confSpeaker4];
  targets.forEach((el, idx) => {
    if (!el) return;
    const value = names[idx];
    if (typeof value === 'string' && value.length > 0) {
      el.textContent = value;
    } else {
      el.textContent = '—';
    }
  });
}

function showConferenceScriptResult(result) {
  resetConferenceOutputs();
  if (!conferenceResultCard) return;
  const data = Array.isArray(result?.data) ? result.data : [];
  const [count, script, duration, s1, s2, s3, s4] = data;

  if (confSpeakerCount) confSpeakerCount.textContent = count != null ? String(count) : '—';
  if (confDuration) confDuration.textContent = duration != null ? String(duration) : '—';
  updateSpeakerNames([s1, s2, s3, s4]);

  if (confProgress) confProgress.textContent = '—';
  if (confStatusDetail) confStatusDetail.textContent = '—';

  if (confScriptEl) {
    if (typeof script === 'string' && script.trim().length > 0) {
      confScriptEl.textContent = script;
    } else {
      confScriptEl.textContent = JSON.stringify(script ?? data, null, 2);
    }
  }
  if (confLogEl) {
    confLogEl.textContent = JSON.stringify(result, null, 2);
    confLogEl.hidden = false;
  }
}

function showDurationResult(result) {
  if (!conferenceResultCard) return;
  conferenceResultCard.hidden = false;
  const data = Array.isArray(result?.data) ? result.data : [];
  const duration = data[0] ?? result?.duration ?? null;
  if (confDuration) {
    if (duration == null) {
      confDuration.textContent = '—';
    } else {
      confDuration.textContent = typeof duration === 'string' ? duration : String(duration);
    }
  }
  if (confLogEl) {
    confLogEl.textContent = JSON.stringify(result, null, 2);
    confLogEl.hidden = false;
  }
}

function showSpeakerVisibilityResult(result) {
  if (!conferenceResultCard) return;
  conferenceResultCard.hidden = false;
  const data = Array.isArray(result?.data) ? result.data : [];
  updateSpeakerNames(data);
  if (confLogEl) {
    confLogEl.textContent = JSON.stringify(result, null, 2);
    confLogEl.hidden = false;
  }
}

function showPodcastResult(result, context = {}) {
  resetConferenceOutputs();
  if (!conferenceResultCard) return;
  const data = Array.isArray(result?.data) ? result.data : [];
  const audioData = data[0];
  const log = data[1];
  const statusDetail = data[2] ?? context.statusDetail ?? null;
  const progressValue = data[3];
  const secondaryStatus = data[4];

  if (confSpeakerCount) {
    if (context.speakerCount != null) {
      confSpeakerCount.textContent = String(context.speakerCount);
    } else {
      confSpeakerCount.textContent = '—';
    }
  }
  if (confDuration) {
    if (context.estimatedDuration) {
      confDuration.textContent = context.estimatedDuration;
    } else {
      confDuration.textContent = '—';
    }
  }

  updateSpeakerNames(context.speakers || []);

  if (confProgress) {
    if (progressValue != null) {
      confProgress.textContent = String(progressValue);
    } else {
      confProgress.textContent = '—';
    }
  }
  if (confStatusDetail) {
    const detail = statusDetail ?? secondaryStatus;
    confStatusDetail.textContent = detail != null && String(detail).length > 0 ? String(detail) : '—';
  }

  const audioUrl = extractAudioSource(audioData);
  if (conferenceAudio && audioUrl) {
    conferenceAudio.hidden = false;
    conferenceAudio.src = audioUrl;
    conferenceAudio.load();
    if (conferenceAudioActions && conferenceDownload) {
      conferenceAudioActions.hidden = false;
      conferenceDownload.href = audioUrl;
    }
  }

  if (confScriptEl && typeof context.script === 'string' && context.script.length > 0) {
    confScriptEl.textContent = context.script;
  }
  if (confLogEl) {
    confLogEl.textContent =
      typeof log === 'string' && log.length > 0 ? log : JSON.stringify(result, null, 2);
    confLogEl.hidden = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  statusLog.innerHTML = '';
  resultCard.hidden = true;
  audioEl.removeAttribute('src');
  downloadLink.removeAttribute('href');
  rawResponse.textContent = '';

  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating…';

  try {
    const formData = new FormData(form);
    const apiUrl = formData.get('apiUrl');
    if (typeof apiUrl !== 'string' || apiUrl.trim().length === 0) {
      throw new Error('API URL is required.');
    }

    const headers = buildHeaders(formData.get('hfToken'));

    const voices = await buildVoicePayload(formData);
    const payload = [
      formData.get('prompt') || '',
      voices[0],
      voices[1],
      voices[2],
      voices[3],
      Number(formData.get('seed')) || 0,
      Number(formData.get('steps')) || 5,
      Number(formData.get('cfgScale')) || 0.5,
      formData.get('useSampling') !== null,
      Number(formData.get('temperature')) || 0.1,
      Number(formData.get('topP')) || 0.1,
      Number(formData.get('maxWords')) || 100,
    ];

    const { eventId } = await requestGeneration(payload, apiUrl, headers);
    const result = await pollForResult(apiUrl, eventId, headers);
    presentTtsResult(result);
  } catch (error) {
    logStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate Speech';
  }
});

if (conferenceForm && conferenceSubmit) {
  conferenceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusLog.innerHTML = '';
    logStatus('Preparing conference script request…');
    conferenceSubmit.disabled = true;
    conferenceSubmit.textContent = 'Generating…';

    try {
      const formData = new FormData(conferenceForm);
      const base = formData.get('apiBase');
      const endpoint = formData.get('endpoint') || 'lambda';
      const apiUrl = combineApiUrl(base, endpoint);
      const headers = buildHeaders(formData.get('hfToken'));
      const natural = formData.get('naturalSounds') !== null;

      const payload = [natural];
      const { eventId } = await requestGeneration(payload, apiUrl, headers);
      const result = await pollForResult(apiUrl, eventId, headers);
      showConferenceScriptResult(result);
    } catch (error) {
      logStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      conferenceSubmit.disabled = false;
      conferenceSubmit.textContent = 'Generate Conference Script';
    }
  });
}

if (durationForm && durationSubmit) {
  durationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusLog.innerHTML = '';
    logStatus('Estimating duration…');
    durationSubmit.disabled = true;
    durationSubmit.textContent = 'Estimating…';

    try {
      const formData = new FormData(durationForm);
      const apiUrl = combineApiUrl(formData.get('apiBase'));
      const headers = buildHeaders(formData.get('hfToken'));
      const script = (formData.get('script') || '').toString();
      const payload = [script];

      const { eventId } = await requestGeneration(payload, apiUrl, headers);
      const result = await pollForResult(apiUrl, eventId, headers);
      showDurationResult(result);
    } catch (error) {
      logStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      durationSubmit.disabled = false;
      durationSubmit.textContent = 'Estimate';
    }
  });
}

if (speakerForm && speakerSubmit) {
  speakerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusLog.innerHTML = '';
    logStatus('Fetching speaker visibility options…');
    speakerSubmit.disabled = true;
    speakerSubmit.textContent = 'Loading…';

    try {
      const formData = new FormData(speakerForm);
      const apiUrl = combineApiUrl(formData.get('apiBase'));
      const headers = buildHeaders(formData.get('hfToken'));
      const count = Number(formData.get('speakerCount')) || 1;
      const payload = [count];

      const { eventId } = await requestGeneration(payload, apiUrl, headers);
      const result = await pollForResult(apiUrl, eventId, headers);
      if (confSpeakerCount) confSpeakerCount.textContent = String(count);
      showSpeakerVisibilityResult(result);
    } catch (error) {
      logStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      speakerSubmit.disabled = false;
      speakerSubmit.textContent = 'Fetch Speakers';
    }
  });
}

if (podcastForm && podcastSubmit) {
  podcastForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusLog.innerHTML = '';
    logStatus('Generating podcast audio…');
    podcastSubmit.disabled = true;
    podcastSubmit.textContent = 'Generating…';

    try {
      const formData = new FormData(podcastForm);
      const apiUrl = combineApiUrl(formData.get('apiBase'));
      const headers = buildHeaders(formData.get('hfToken'));

      const model = (formData.get('model') || 'VibeVoice-1.5B').toString();
      const speakerCount = Number(formData.get('speakerCount')) || 1;
      const script = (formData.get('script') || '').toString();
      if (script.trim().length === 0) {
        throw new Error('Conversation script is required for podcast generation.');
      }
      const cfgScale = Number(formData.get('cfgScale')) || 1;
      const speakers = [
        (formData.get('speaker1') || '').toString(),
        (formData.get('speaker2') || '').toString(),
        (formData.get('speaker3') || '').toString(),
        (formData.get('speaker4') || '').toString(),
      ];

      const payload = [
        model,
        speakerCount,
        script,
        speakers[0],
        speakers[1],
        speakers[2],
        speakers[3],
        cfgScale,
      ];

      const { eventId } = await requestGeneration(payload, apiUrl, headers);
      const result = await pollForResult(apiUrl, eventId, headers);
      const context = {
        speakerCount,
        script,
        speakers,
        estimatedDuration: confDuration?.textContent && confDuration.textContent !== '—'
          ? confDuration.textContent
          : undefined,
      };
      showPodcastResult(result, context);
    } catch (error) {
      logStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      podcastSubmit.disabled = false;
      podcastSubmit.textContent = 'Create Podcast Audio';
    }
  });
}
