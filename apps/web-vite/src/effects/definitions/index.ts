import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { colorCorrectEffectDefinition } from "./color-correct";
import { chromaticAberrEffectDefinition } from "./chromatic-aberr";
import { vignetteEffectDefinition } from "./vignette";
import { sharpenEffectDefinition } from "./sharpen";
import { sepiaEffectDefinition, grayscaleEffectDefinition, invertEffectDefinition } from "./color-transforms";
import { pixelateEffectDefinition } from "./pixelate";
import { noiseEffectDefinition } from "./noise";
import { lensDistortionEffectDefinition } from "./lens-distortion";
import { glowEffectDefinition } from "./glow";

const defaultEffects = [
	blurEffectDefinition,
	colorCorrectEffectDefinition,
	chromaticAberrEffectDefinition,
	vignetteEffectDefinition,
	sharpenEffectDefinition,
	sepiaEffectDefinition,
	grayscaleEffectDefinition,
	invertEffectDefinition,
	pixelateEffectDefinition,
	noiseEffectDefinition,
	lensDistortionEffectDefinition,
	glowEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register({
			key: definition.type,
			definition,
		});
	}
}
