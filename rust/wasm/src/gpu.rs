#![cfg(target_arch = "wasm32")]

use std::cell::RefCell;
use std::sync::{Arc, Mutex};

use effects::EffectPipeline;
use gpu::{DeviceLostInfo, GpuContext, wgpu};
use js_sys::{Object, Reflect};
use masks::MaskFeatherPipeline;
use serde::Deserialize;
use wasm_bindgen::{JsCast, JsValue, prelude::wasm_bindgen};
use wasm_bindgen_futures::spawn_local;

pub(crate) struct GpuRuntime {
    pub(crate) context: GpuContext,
    pub(crate) effects: EffectPipeline,
    pub(crate) masks: MaskFeatherPipeline,
}

thread_local! {
    static GPU_RUNTIME: RefCell<Option<GpuRuntime>> = const { RefCell::new(None) };
}

fn set_panic_hook() {
    static SET_HOOK: std::sync::Once = std::sync::Once::new();
    SET_HOOK.call_once(|| {
        std::panic::set_hook(Box::new(|info| {
            // Store the full panic message in window.__wasmPanic so the JS catch block
            // can surface it instead of the opaque "Unreachable" WASM trap message.
            if let Some(window) = web_sys::window() {
                let _ = Reflect::set(
                    &window,
                    &JsValue::from_str("__wasmPanic"),
                    &JsValue::from_str(&info.to_string()),
                );
            }
            console_error_panic_hook::hook(info);
        }));
    });
}

#[wasm_bindgen(js_name = initializeGpu)]
pub async fn initialize_gpu() -> Result<(), JsValue> {
    set_panic_hook();

    if GPU_RUNTIME.with(|runtime| runtime.borrow().is_some()) {
        return Ok(());
    }

    let context = GpuContext::new()
        .await
        .map_err(|error| JsValue::from_str(&error.to_string()))?;

    let device_lost_state = Arc::new(Mutex::new(None::<DeviceLostInfo>));
    let state_for_callback = device_lost_state.clone();

    context.set_device_lost_callback(Box::new(move |info| {
        if let Ok(mut state) = state_for_callback.lock() {
            *state = Some(info);
        }
        spawn_local(async move {
            handle_device_lost(device_lost_state.clone()).await;
        });
    }));

    let effects = EffectPipeline::new(&context);
    let masks = MaskFeatherPipeline::new(&context);

    GPU_RUNTIME.with(|runtime| {
        runtime.replace(Some(GpuRuntime {
            context,
            effects,
            masks,
        }));
    });

    Ok(())
}

async fn handle_device_lost(device_lost_state: Arc<Mutex<Option<DeviceLostInfo>>>) {
    let info = device_lost_state.lock().unwrap().take();
    if let Some(info) = info {
        let window = web_sys::window().unwrap();
        let _ = Reflect::set(
            &window,
            &JsValue::from_str("__gpuDeviceLostReason"),
            &JsValue::from_str(&info.reason),
        );
        let _ = Reflect::set(
            &window,
            &JsValue::from_str("__gpuDeviceLostMessage"),
            &JsValue::from_str(&info.message),
        );
    }

    recover_gpu().await;
}

async fn recover_gpu() {
    for attempt in 0..3 {
        GPU_RUNTIME.with(|runtime| {
            runtime.borrow_mut().take();
        });

        match GpuContext::new().await {
            Ok(context) => {
                let device_lost_state = Arc::new(Mutex::new(None::<DeviceLostInfo>));
                let state_for_callback = device_lost_state.clone();

                context.set_device_lost_callback(Box::new(move |info| {
                    if let Ok(mut state) = state_for_callback.lock() {
                        *state = Some(info);
                    }
                    spawn_local(async move {
                        handle_device_lost(device_lost_state.clone()).await;
                    });
                }));

                let effects = EffectPipeline::new(&context);
                let masks = MaskFeatherPipeline::new(&context);

                GPU_RUNTIME.with(|runtime| {
                    runtime.replace(Some(GpuRuntime {
                        context,
                        effects,
                        masks,
                    }));
                });

                let window = web_sys::window().unwrap();
                let _ = Reflect::set(
                    &window,
                    &JsValue::from_str("__gpuDeviceRecovered"),
                    &JsValue::from_bool(true),
                );
                return;
            }
            Err(_) => {
                if attempt < 2 {
                    delay_ms(100).await;
                }
            }
        }
    }

    let window = web_sys::window().unwrap();
    let _ = Reflect::set(
        &window,
        &JsValue::from_str("__gpuDeviceLostError"),
        &JsValue::from_str("GPU device recovery failed after 3 attempts. Please reload the page."),
    );
}

fn delay_ms(ms: u32) -> impl std::future::Future<Output = ()> {
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        let resolve = Closure::once(move || {
            resolve.call0(&JsValue::UNDEFINED).unwrap();
        });
        let _ = set_timeout(&resolve, ms);
        resolve.forget();
    });
    wasm_bindgen_futures::JsFuture::from(promise).then(|_| async {})
}

use wasm_bindgen::closure::Closure;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = setTimeout, catch)]
    fn set_timeout(closure: &Closure<dyn FnMut()>, ms: u32) -> Result<i32, JsValue>;
}

pub(crate) fn with_gpu_runtime<T>(
    action: impl FnOnce(&GpuRuntime) -> Result<T, JsValue>,
) -> Result<T, JsValue> {
    GPU_RUNTIME.with(|runtime| {
        let borrow = runtime.borrow();
        let Some(gpu_runtime) = borrow.as_ref() else {
            return Err(JsValue::from_str(
                "GPU context not initialized. Call initializeGpu() first.",
            ));
        };
        action(gpu_runtime)
    })
}

pub(crate) fn import_canvas_texture(
    context: &GpuContext,
    canvas: &wgpu::web_sys::OffscreenCanvas,
    width: u32,
    height: u32,
    label: &'static str,
) -> wgpu::Texture {
    context.import_offscreen_canvas_texture(canvas, width, height, label)
}

pub(crate) fn render_texture_to_canvas(
    context: &GpuContext,
    texture: &wgpu::Texture,
    width: u32,
    height: u32,
) -> Result<wgpu::web_sys::OffscreenCanvas, JsValue> {
    let canvas = wgpu::web_sys::OffscreenCanvas::new(width, height)?;
    context
        .render_texture_to_offscreen_canvas(texture, &canvas, width, height)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    Ok(canvas)
}

pub(crate) fn read_property(object: &Object, name: &str) -> Result<JsValue, JsValue> {
    Reflect::get(object, &JsValue::from_str(name))
        .map_err(|_| JsValue::from_str(&format!("Missing property '{name}'")))
}

pub(crate) fn read_offscreen_canvas_property(
    object: &Object,
    name: &str,
) -> Result<wgpu::web_sys::OffscreenCanvas, JsValue> {
    read_property(object, name)?
        .dyn_into::<wgpu::web_sys::OffscreenCanvas>()
        .map_err(|_| JsValue::from_str(&format!("Property '{name}' must be an OffscreenCanvas")))
}

pub(crate) fn read_u32_property(object: &Object, name: &str) -> Result<u32, JsValue> {
    let value = read_property(object, name)?;
    let Some(number) = value.as_f64() else {
        return Err(JsValue::from_str(&format!(
            "Property '{name}' must be a number"
        )));
    };
    Ok(number as u32)
}

pub(crate) fn read_f32_property(object: &Object, name: &str) -> Result<f32, JsValue> {
    let value = read_property(object, name)?;
    let Some(number) = value.as_f64() else {
        return Err(JsValue::from_str(&format!(
            "Property '{name}' must be a number"
        )));
    };
    Ok(number as f32)
}

pub(crate) fn read_serde_property<T>(object: &Object, name: &str) -> Result<T, JsValue>
where
    T: for<'de> Deserialize<'de>,
{
    let value = read_property(object, name)?;
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&format!("Invalid property '{name}': {error}")))
}
