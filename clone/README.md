# Eburon TTS Studio

The `clone/` directory now contains a neutral, private-label frontend for orchestrating internal text-to-speech cloning and multi-speaker conversation pipelines. Everything is branded as **Eburon TTS Studio**, and no vendor names appear in the UI.

The studio assumes your backends expose Gradio-style REST endpoints: submit a POST to start a job, receive an `event_id`, then poll the matching GET endpoint until synthesis finishes. The shared status panel records each step so you can diagnose issues quickly.

## Getting Started

1. Serve the static files (for example, `npx serve clone`) or open `clone/index.html` directly in a modern browser.
2. Provide the API base URLs for your speech or conversation services (placeholders are supplied in the forms).
3. (Optional) Paste your service token where prompted if the endpoint requires authentication.
4. Complete the payload inputs, trigger the desired action, and monitor the status panel while the app runs the POST + poll workflow.

> ⚠️ **CORS**: Some Spaces disallow browser-origin requests. If you encounter network errors, proxy the traffic through your own backend or run the suggested `curl` commands server-side.

## Text-to-Speech Cloning

The **API Settings** card drives `generate_speech_gradio`. You can:

- Provide up to four local reference clips or remote URLs (missing slots fall back to the bundled sample WAV).
- Tune seed, diffusion steps, CFG scale, sampling, temperature, top-p, and chunk length.
- Inspect the full JSON payload/response in the **Status** and **Generated Speech** cards and download the synthesized audio once ready.

## Conference Generator Toolkit

Three additional sections wrap the `acloudcenter-conference-generator-vibevoice` endpoints:

### 1. Conference Script Generator (`lambda`, `lambda_1` … `lambda_7`)

- Pick the desired lambda endpoint from the dropdown and toggle natural talking sounds.
- The studio POSTs `[boolean]` to `/gradio_api/call/{lambda_variant}` and polls for `[speakerCount, script, duration, speaker1, … speaker4]`.
- Results populate the **Conference Outputs** card (script, speaker roster, duration, status, raw JSON).

### 2. Utilities

- **Estimate Duration**: Sends the conversation script to `/estimate_duration` and updates the duration field.
- **Update Speaker Visibility**: Sends the speaker count to `/update_speaker_visibility` and refreshes the speaker names list.

Each utility form accepts its own API URL and optional token so you can point at customized deployments.

### 3. Podcast Audio (`generate_podcast_wrapper`)

- Define the model, CFG scale, script, and voice IDs for four speaker slots.
- After the job finishes, the card reveals the downloadable audio, progress, and generation log.
- Speaker names reuse the values provided in the form; adjust them to match the script.

## Tips

- The shared **Status** panel chronicles every request. Clear it between runs by launching a new action.
- Output cards persist the latest results; run the `lambda` generator first if you want a script before calling the podcast wrapper.
- When experimenting with new endpoints, duplicate one of the existing forms and adjust the payload structure—`main.js` consolidates shared helpers such as polling, header construction, and audio handling.
