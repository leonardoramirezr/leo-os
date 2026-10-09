<script lang="ts" module>
	import { SIZES, type TextLayer } from '$lib/text';

	/** How the last text was written: a new one starts out the same, as on Instagram. */
	let last: Pick<TextLayer, 'font' | 'color' | 'mode' | 'align' | 'size'> = {
		font: 'classic',
		color: '#ffffff',
		mode: 'plain',
		align: 'center',
		size: SIZES.initial
	};
</script>

<script lang="ts">
	// The text on one photo, as on a story: «Aa», or a tap on the photo, writes a new one, and a tap
	// on one writes it again. One finger moves it and two make it bigger or smaller and turn it;
	// held over the bin, it goes. While it is typed the photo steps back, and the font, the colour,
	// what is done with the colour, the alignment and the size are at hand, as Instagram and TikTok
	// keep them. Nothing reaches the composer until «Listo».
	import { flushSync, onMount, untrack } from 'svelte';
	import { HomeButton } from '@leo-os/shared';
	import { newId } from '$lib/code';
	import { ASPECTS, type Aspect, type Focus } from '$lib/images';
	import {
		COLORS,
		FONT_IDS,
		FONTS,
		MODES,
		fontStyle,
		hits,
		nextMode,
		typedStyle,
		type Align
	} from '$lib/text';
	import Icon, { type IconName } from './Icon.svelte';
	import TextLayers from './TextLayers.svelte';

	let {
		photo,
		focus,
		aspect,
		texts,
		ondone,
		oncancel
	}: {
		/** The photo, and where it is framed. */
		photo: string;
		focus: Focus;
		aspect: Aspect;
		texts: readonly TextLayer[];
		ondone: (texts: TextLayer[]) => void;
		oncancel: () => void;
	} = $props();

	interface Point {
		x: number;
		y: number;
	}

	/** The fingers on the photo: where they are between them, how far apart and at what angle. */
	interface Spread extends Point {
		distance: number;
		angle: number;
	}

	interface Gesture {
		/** The text being handled; none when it started on the photo itself. */
		layer?: TextLayer;
		moved: boolean;
		/** The fingers and the text when a finger was last put down or lifted: the rest is from there. */
		from: Spread;
		start: Pick<TextLayer, 'x' | 'y' | 'scale' | 'angle'>;
	}

	const ALIGNS: Record<Align, { next: Align; icon: IconName; label: string }> = {
		center: { next: 'left', icon: 'align-center', label: 'Centrado' },
		left: { next: 'right', icon: 'align-left', label: 'A la izquierda' },
		right: { next: 'center', icon: 'align-right', label: 'A la derecha' }
	};
	/** Within this many pixels of the middle, a text snaps to it. */
	const SNAP = 8;
	/** Within this many radians of upright, or of a quarter turn, a text snaps to it. */
	const SNAP_ANGLE = 0.07;
	const SCALES = { min: 0.3, max: 6 };

	const initial = untrack(() => JSON.stringify(texts));
	let layers = $state<TextLayer[]>(JSON.parse(initial));
	/** The text being typed. */
	let typing = $state<TextLayer>();
	/** The photo's width when typing began: the field keeps to it while the keyboard shrinks the photo. */
	let typingWidth = $state(0);
	/** The text a finger is moving: the bin and the guides are up for it. */
	let moving = $state<TextLayer>();
	let overBin = $state(false);
	let guides = $state({ x: false, y: false });

	let editor: HTMLDivElement;
	let stage = $state<HTMLDivElement>();
	let field = $state<HTMLDivElement>();
	let bin = $state<HTMLDivElement>();
	let slider = $state<HTMLDivElement>();

	/** Where each finger on the photo is, by pointer, in the photo's pixels. */
	const fingers = new Map<number, Point>();
	let gesture: Gesture | undefined;
	/** What a tap landed on, for the click that follows it: iOS brings up the keyboard from a click. */
	let tapped: TextLayer | 'photo' | undefined;
	let sliding = false;

	onMount(() => {
		// iOS Safari doesn't shrink the layout when the keyboard opens, so size the editor to what's visible.
		const viewport = window.visualViewport;
		const fitViewport = () => {
			if (!viewport || viewport.scale > 1.01) {
				editor.style.height = '';
				editor.style.transform = '';
			} else {
				editor.style.height = `${viewport.height}px`;
				editor.style.transform = `translateY(${viewport.offsetTop}px)`;
			}
		};
		fitViewport();
		viewport?.addEventListener('resize', fitViewport);
		viewport?.addEventListener('scroll', fitViewport);

		// Black up to the top of the screen, where iOS leaves its band (README.md, «Home»).
		const root = document.documentElement.style;
		const band = root.getPropertyValue('--status-bar');
		root.setProperty('--status-bar', '#000000');

		// Not passive, so that a trackpad's pinch sizes the text instead of zooming the page.
		stage?.addEventListener('wheel', onwheel, { passive: false });

		// «Aa» on a photo with no text yet is for writing one: the field comes up within that tap.
		if (layers.length === 0) addText();

		return () => {
			viewport?.removeEventListener('resize', fitViewport);
			viewport?.removeEventListener('scroll', fitViewport);
			stage?.removeEventListener('wheel', onwheel);
			if (band) root.setProperty('--status-bar', band);
			else root.removeProperty('--status-bar');
		};
	});

	// The field is filled and focused the moment it is there, still within the tap that asked for it,
	// which is what lets iOS bring up the keyboard.
	$effect(() => {
		if (!field) return;
		field.textContent = untrack(() => typing?.text ?? '');
		field.focus();
		const range = document.createRange();
		range.selectNodeContents(field);
		range.collapse(false);
		const selection = getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	});

	function begin(layer: TextLayer) {
		if (!stage) return;
		typingWidth = stage.clientWidth;
		typing = layer;
	}

	function addText() {
		layers.push({ id: newId(), text: '', ...last, x: 0.5, y: 0.5, scale: 1, angle: 0 });
		begin(layers[layers.length - 1]);
	}

	/** «Aa», or a text's own button: the field is up before the tap is over. */
	function write(layer?: TextLayer) {
		if (layer) begin(layer);
		else addText();
		flushSync();
	}

	/**
	 * The field's text as typed. `innerText` would give it in capitals where the font puts them, and
	 * `textContent` without the new lines a browser keeps as `<br>`, or as a paragraph of their own.
	 */
	function typedIn(node: Node): string {
		let text = '';
		for (const child of node.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				text += child.nodeValue ?? '';
			} else if (child.nodeName === 'BR') {
				text += '\n';
			} else {
				if (/^(DIV|P)$/.test(child.nodeName) && text && !text.endsWith('\n')) text += '\n';
				text += typedIn(child);
			}
		}
		return text;
	}

	function oninput() {
		if (typing && field) typing.text = typedIn(field);
	}

	/** Without spaces at the ends of its lines, nor blank lines before or after it. */
	function tidy(text: string): string {
		return text
			.split('\n')
			.map((line) => line.trimEnd())
			.join('\n')
			.replace(/^\n+|\n+$/g, '');
	}

	/** Done typing: an empty text is gone, as on Instagram. */
	function finish() {
		const layer = typing;
		if (!layer) return;
		field?.blur();
		layer.text = tidy(layer.text);
		if (layer.text) {
			const { font, color, mode, align, size } = layer;
			last = { font, color, mode, align, size };
		} else {
			remove(layer);
		}
		typing = undefined;
	}

	function remove(layer: TextLayer) {
		const index = layers.indexOf(layer);
		if (index >= 0) layers.splice(index, 1);
	}

	function done() {
		finish();
		ondone($state.snapshot(layers).filter((layer) => layer.text.trim()));
	}

	function cancel() {
		finish();
		const changed = JSON.stringify($state.snapshot(layers)) !== initial;
		if (changed && !confirm('¿Descartar los cambios del texto?')) return;
		oncancel();
	}

	// ——— Moving, sizing and turning

	function pointOf(event: MouseEvent): Point {
		const box = stage!.getBoundingClientRect();
		return { x: event.clientX - box.left, y: event.clientY - box.top };
	}

	/** The text under a point, the topmost. */
	function textAt(point: Point): TextLayer | undefined {
		if (!stage) return undefined;
		const { clientWidth: width, clientHeight: height } = stage;
		return layers.findLast((layer) => hits(layer, point.x, point.y, width, height, 12));
	}

	function spread(): Spread {
		const [a, b] = fingers.values();
		if (!b) return { x: a.x, y: a.y, distance: 0, angle: 0 };
		return {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2,
			distance: Math.hypot(b.x - a.x, b.y - a.y),
			angle: Math.atan2(b.y - a.y, b.x - a.x)
		};
	}

	/** Takes the gesture from where the fingers and the text are now. */
	function rebase() {
		if (!gesture || fingers.size === 0) return;
		gesture.from = spread();
		const layer = gesture.layer;
		if (layer) gesture.start = { x: layer.x, y: layer.y, scale: layer.scale, angle: layer.angle };
	}

	/** On top of the others from the moment it is touched, as on Instagram. */
	function raise(layer: TextLayer) {
		remove(layer);
		layers.push(layer);
	}

	function onpointerdown(event: PointerEvent) {
		if (!stage || typing) return;
		tapped = undefined;
		stage.setPointerCapture(event.pointerId);
		fingers.set(event.pointerId, pointOf(event));
		if (fingers.size === 1) {
			const layer = textAt(pointOf(event));
			if (layer) raise(layer);
			gesture = { layer, moved: false, from: spread(), start: { x: 0, y: 0, scale: 1, angle: 0 } };
		} else if (gesture && !gesture.layer) {
			// Two fingers that started off the text still pinch the one between them.
			const layer = textAt(spread()) ?? textAt(pointOf(event));
			if (layer) raise(layer);
			gesture.layer = layer;
		}
		rebase();
	}

	function onpointermove(event: PointerEvent) {
		if (!stage || !gesture || !fingers.has(event.pointerId)) return;
		fingers.set(event.pointerId, pointOf(event));
		const now = spread();
		const pinching = fingers.size > 1;
		const travel = Math.hypot(now.x - gesture.from.x, now.y - gesture.from.y);
		if (!gesture.moved && !pinching && travel < 6) return;
		gesture.moved = true;
		const layer = gesture.layer;
		if (!layer) return;
		moving = layer;

		const { clientWidth: width, clientHeight: height } = stage;
		const x = gesture.start.x + (now.x - gesture.from.x) / width;
		const y = gesture.start.y + (now.y - gesture.from.y) / height;
		// The middle holds it a little, and a line shows where, as on Instagram.
		guides = { x: Math.abs(x - 0.5) * width < SNAP, y: Math.abs(y - 0.5) * height < SNAP };
		layer.x = guides.x ? 0.5 : Math.min(1, Math.max(0, x));
		layer.y = guides.y ? 0.5 : Math.min(1, Math.max(0, y));
		if (pinching && gesture.from.distance > 0) {
			const scale = (gesture.start.scale * now.distance) / gesture.from.distance;
			layer.scale = Math.min(SCALES.max, Math.max(SCALES.min, scale));
			// The turn the fingers made, the short way round.
			const turn = now.angle - gesture.from.angle;
			layer.angle = upright(gesture.start.angle + Math.atan2(Math.sin(turn), Math.cos(turn)));
		}
		// Only with one finger, as on Instagram: two are sizing it.
		overBin = !pinching && near(event, bin);
	}

	function onpointerup(event: PointerEvent) {
		if (!fingers.delete(event.pointerId)) return;
		if (fingers.size > 0) {
			// One of two fingers lifted: the other carries on from where it is.
			overBin = false;
			rebase();
			return;
		}
		const ended = gesture;
		const dropped = overBin && event.type === 'pointerup';
		gesture = undefined;
		moving = undefined;
		overBin = false;
		guides = { x: false, y: false };
		if (!ended) return;
		if (dropped && ended.layer) remove(ended.layer);
		else if (!ended.moved && event.type === 'pointerup') tapped = ended.layer ?? 'photo';
	}

	function onclick() {
		const target = tapped;
		tapped = undefined;
		if (target) write(target === 'photo' ? undefined : target);
	}

	/** A trackpad's pinch, which comes as a wheel with Control pressed. */
	function onwheel(event: WheelEvent) {
		if (!event.ctrlKey || typing) return;
		const layer = textAt(pointOf(event));
		if (!layer) return;
		event.preventDefault();
		layer.scale = Math.min(SCALES.max, Math.max(SCALES.min, layer.scale * Math.exp(-event.deltaY / 100)));
	}

	function upright(angle: number): number {
		const quarter = Math.PI / 2;
		const nearest = Math.round(angle / quarter) * quarter;
		return Math.abs(angle - nearest) < SNAP_ANGLE ? nearest : angle;
	}

	/** Whether a finger is over an element, or nearly. */
	function near(event: PointerEvent, element: HTMLElement | undefined): boolean {
		if (!element) return false;
		const box = element.getBoundingClientRect();
		const reach = 24;
		return (
			event.clientX > box.left - reach &&
			event.clientX < box.right + reach &&
			event.clientY > box.top - reach &&
			event.clientY < box.bottom + reach
		);
	}

	// ——— The tools while typing

	/** Keeps the keyboard up: a tap on a tool would otherwise take the focus from the field. */
	function keep(event: PointerEvent) {
		event.preventDefault();
	}

	function setFont(font: TextLayer['font']) {
		if (typing) typing.font = font;
	}

	function setColor(color: string) {
		if (typing) typing.color = color;
	}

	function cycleMode() {
		if (typing) typing.mode = nextMode(typing.mode);
	}

	function cycleAlign() {
		if (typing) typing.align = ALIGNS[typing.align].next;
	}

	/** Bigger towards the top, as Instagram's slider. */
	function slide(event: PointerEvent) {
		if (!typing || !slider) return;
		const box = slider.getBoundingClientRect();
		const value = Math.min(1, Math.max(0, (box.bottom - event.clientY) / box.height));
		typing.size = SIZES.min + value * (SIZES.max - SIZES.min);
	}

	const STEPS: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };

	function onsliderkeydown(event: KeyboardEvent) {
		const step = STEPS[event.key];
		if (!typing || !step) return;
		event.preventDefault();
		typing.size = Math.min(SIZES.max, Math.max(SIZES.min, typing.size + step * 0.005));
	}

	function onfieldkeydown(event: KeyboardEvent) {
		// Enter is a new line, as on Instagram; Escape, or ⌘/Ctrl + Enter, is «Listo».
		if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
			event.preventDefault();
			finish();
		}
	}

	const custom = $derived(typing && !COLORS.some(({ hex }) => hex === typing?.color));
	const paragraphs = $derived(typing?.text.split('\n') ?? []);
	const level = $derived(typing ? (typing.size - SIZES.min) / (SIZES.max - SIZES.min) : 0);
</script>

<div class="editor" class:writing={typing} bind:this={editor}>
	<header>
		<button class="text-button" type="button" onclick={cancel}>Cancelar</button>
		<h1 class="display">Texto</h1>
		<button class="text-button done" type="button" onclick={done}>Listo</button>
		<HomeButton />
	</header>

	<div class="work">
		<!-- A tap writes and a drag moves: the buttons under the photo do as much by keyboard. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<div
			class="stage"
			bind:this={stage}
			style:--aspect={ASPECTS[aspect]}
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			onpointercancel={onpointerup}
			{onclick}
			role="group"
			aria-label="Foto"
		>
			<img
				src={photo}
				alt=""
				draggable="false"
				style:object-position="{focus.x * 100}% {focus.y * 100}%"
			/>
			<TextLayers {layers} skip={typing?.id} faded={overBin ? moving?.id : undefined} />
			{#if guides.x}<span class="guide down"></span>{/if}
			{#if guides.y}<span class="guide across"></span>{/if}
		</div>
	</div>

	<footer>
		{#if moving}
			<div class="bin" class:over={overBin} bind:this={bin} aria-hidden="true">
				<Icon name="trash" size={26} />
			</div>
			<p class="hint">Suéltalo aquí para quitarlo</p>
		{:else}
			<button class="add" type="button" onclick={() => write()} aria-label="Añadir texto">
				<Icon name="text" size={28} />
			</button>
			<p class="hint">
				{layers.length
					? 'Toca un texto para cambiarlo, arrástralo para moverlo o gíralo con dos dedos'
					: 'Toca la foto para escribir'}
			</p>
		{/if}
		<ul class="visually-hidden">
			{#each layers as layer (layer.id)}
				<li><button type="button" onclick={() => write(layer)}>Cambiar «{layer.text}»</button></li>
			{/each}
		</ul>
	</footer>

	{#if typing}
		{@const style = typedStyle(typing, typingWidth)}
		<div class="typing">
			<div class="bar">
				<button
					class="tool"
					type="button"
					onpointerdown={keep}
					onclick={cycleAlign}
					aria-label="Alineación: {ALIGNS[typing.align].label}"
				>
					<Icon name={ALIGNS[typing.align].icon} />
				</button>
				{#if !FONTS[typing.font].glow}
					<button
						class="tool"
						type="button"
						onpointerdown={keep}
						onclick={cycleMode}
						aria-label="Estilo: {MODES[typing.mode]}"
					>
						<span class="sample {typing.mode}" aria-hidden="true">A</span>
					</button>
				{/if}
				<span class="space"></span>
				<button class="text-button done" type="button" onpointerdown={keep} onclick={finish}>
					Listo
				</button>
				<HomeButton />
			</div>

			<div class="middle">
				<!-- A tap around the text is «Listo», as on Instagram; the button is for the keyboard. -->
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					class="write"
					onclick={(event) => {
						if (event.target === event.currentTarget) finish();
					}}
				>
					<div class="field" style:max-width="{style.maxWidth}px" style:text-align={typing.align}>
						<!-- A paragraph to a box, and none for a blank line, as the canvas draws them. On one
						     line: any space between these tags would be text in the copy. -->
						<div
							class="boxes"
							aria-hidden="true"
							style={style.font}
							style:opacity={style.boxOpacity}
						>
							{#each paragraphs as part, i (i)}{#if i}{'\n'}{/if}{#if part.trim()}<span
										style={style.box}>{part}</span
									>{:else}{part}{/if}{/each}
						</div>
						<div
							class="input"
							bind:this={field}
							contenteditable="plaintext-only"
							role="textbox"
							tabindex="0"
							aria-multiline="true"
							aria-label="Texto"
							spellcheck="false"
							style="{style.font}; {style.field}"
							{oninput}
							onkeydown={onfieldkeydown}
						></div>
					</div>
				</div>

				<div
					class="size"
					bind:this={slider}
					onpointerdown={(event) => {
						keep(event);
						slider?.setPointerCapture(event.pointerId);
						sliding = true;
						slide(event);
					}}
					onpointermove={(event) => {
						if (sliding) slide(event);
					}}
					onpointerup={() => (sliding = false)}
					onpointercancel={() => (sliding = false)}
					onkeydown={onsliderkeydown}
					role="slider"
					tabindex="0"
					aria-label="Tamaño"
					aria-orientation="vertical"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(level * 100)}
				>
					<span class="track"></span>
					<span class="thumb" style:top="{(1 - level) * 100}%"></span>
				</div>
			</div>

			<div class="colors" role="radiogroup" aria-label="Color">
				{#each COLORS as color (color.hex)}
					<button
						type="button"
						role="radio"
						aria-checked={typing.color === color.hex}
						aria-label={color.name}
						style:background-color={color.hex}
						onpointerdown={keep}
						onclick={() => setColor(color.hex)}
					></button>
				{/each}
				<label class="custom" class:checked={custom}>
					<input
						type="color"
						value={typing.color}
						oninput={(event) => setColor(event.currentTarget.value)}
						aria-label="Otro color"
					/>
				</label>
			</div>

			<div class="fonts" role="radiogroup" aria-label="Letra">
				{#each FONT_IDS as id (id)}
					<button
						type="button"
						role="radio"
						aria-checked={typing.font === id}
						style={fontStyle(id)}
						onpointerdown={keep}
						onclick={() => setFont(id)}
					>
						{FONTS[id].name}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Black, whatever the theme: the photo is what has colour. The outlines are cream on it, as they
	   are in the dark. */
	.editor {
		--ink: #f2f2ec;
		display: flex;
		position: fixed;
		z-index: 30;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		flex-direction: column;
		background: #000;
		color: #fff;
		overscroll-behavior: contain;
	}

	header,
	.bar {
		display: flex;
		flex: none;
		align-items: center;
		height: 52px;
		padding: 0 8px 0 12px;
	}

	h1 {
		flex: 1;
		margin: 0;
		font-size: 22px;
		text-align: center;
	}

	.editor .text-button {
		width: 96px;
		color: #fff;
		text-align: left;
	}

	.editor .done {
		color: var(--lime);
		font-weight: 800;
		text-align: right;
	}

	/* While typing, only the photo shows under the tools, darkened. */
	.editor.writing > header,
	.editor.writing > footer {
		visibility: hidden;
	}

	.work {
		display: grid;
		flex: 1;
		min-height: 0;
		place-items: center;
		container-type: size;
	}

	.stage {
		position: relative;
		width: min(100cqw, 100cqh * var(--aspect));
		aspect-ratio: var(--aspect);
		overflow: hidden;
		background: #121212;
		touch-action: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.stage img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		-webkit-touch-callout: none;
	}

	.guide {
		position: absolute;
		background: var(--lime);
		pointer-events: none;
	}

	.guide.down {
		top: 0;
		bottom: 0;
		left: calc(50% - 0.5px);
		width: 1px;
	}

	.guide.across {
		top: calc(50% - 0.5px);
		right: 0;
		left: 0;
		height: 1px;
	}

	footer {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 112px;
		padding: 12px 16px;
		-webkit-user-select: none;
		user-select: none;
	}

	.add,
	.bin {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		color: #fff;
	}

	.add {
		padding: 0;
		border: var(--line) solid var(--ink);
		background: var(--lime);
		color: var(--on-lime);
		box-shadow: 3px 3px 0 var(--ink);
	}

	.bin {
		border: 1.5px solid rgb(255 255 255 / 0.7);
		background: rgb(255 255 255 / 0.12);
		transition:
			transform 0.15s,
			background-color 0.15s;
	}

	.bin.over {
		border-color: var(--danger);
		background: var(--danger);
		transform: scale(1.25);
	}

	.hint {
		max-width: 320px;
		margin: 0;
		color: rgb(255 255 255 / 0.6);
		font-size: 12px;
		line-height: 16px;
		text-align: center;
	}

	/* ——— While typing */

	.typing {
		display: flex;
		position: absolute;
		z-index: 2;
		inset: 0;
		flex-direction: column;
		background: rgb(0 0 0 / 0.6);
	}

	.tool {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: #fff;
	}

	.space {
		flex: 1;
	}

	/* The «A» shows what the colour does now. */
	.sample {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 6px;
		font-size: 17px;
		font-weight: 800;
		line-height: 1;
	}

	.sample.plain {
		box-shadow: inset 0 0 0 1.5px #fff;
	}

	.sample.box {
		background: #fff;
		color: #000;
	}

	.sample.soft {
		background: rgb(255 255 255 / 0.4);
	}

	.sample.outline {
		color: #000;
		-webkit-text-stroke: 3px #fff;
		paint-order: stroke fill;
	}

	.sample.shadow {
		text-shadow: 2px 2px 0 #8e8e8e;
	}

	.middle {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	/* Centred, and yet scrolled from its top when it is taller than the room. */
	.write {
		display: flex;
		position: absolute;
		inset: 0;
		padding: 16px;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.field {
		position: relative;
		width: fit-content;
		margin: auto;
	}

	/* The field and its copy break their lines alike: same font, same room, same rules. */
	.boxes,
	.input {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.boxes {
		position: absolute;
		inset: 0;
		color: transparent;
		pointer-events: none;
	}

	.boxes span {
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}

	.input {
		position: relative;
		min-height: 1lh;
		outline: none;
		cursor: text;
		-webkit-user-select: text;
		user-select: text;
	}

	.size {
		position: absolute;
		top: 50%;
		left: 4px;
		width: 40px;
		height: min(240px, 70%);
		transform: translateY(-50%);
		cursor: ns-resize;
		touch-action: none;
	}

	.size:focus-visible {
		outline-offset: 0;
	}

	.track {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(50% - 7px);
		width: 14px;
		background: rgb(255 255 255 / 0.45);
		clip-path: polygon(0 0, 100% 0, 50% 100%);
	}

	.thumb {
		position: absolute;
		left: calc(50% - 11px);
		width: 22px;
		height: 22px;
		margin-top: -11px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
		pointer-events: none;
	}

	.colors,
	.fonts {
		display: flex;
		flex: none;
		gap: 10px;
		padding: 8px 14px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.colors::-webkit-scrollbar,
	.fonts::-webkit-scrollbar {
		display: none;
	}

	.colors button,
	.custom {
		flex: none;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 2px solid #fff;
		border-radius: 50%;
		transition: transform 0.15s;
	}

	.colors [aria-checked='true'],
	.custom.checked {
		transform: scale(1.2);
		box-shadow: 0 0 0 2px #000;
	}

	.custom {
		position: relative;
		overflow: hidden;
		background: conic-gradient(#ff3b30, #ffcc00, #34c759, #5ac8fa, #007aff, #af52de, #ff3b30);
	}

	.custom input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		opacity: 0;
		cursor: pointer;
	}

	.fonts {
		gap: 8px;
		padding-bottom: 14px;
	}

	.fonts button {
		flex: none;
		height: 34px;
		padding: 0 14px;
		border: 1.5px solid rgb(255 255 255 / 0.85);
		border-radius: 17px;
		background: rgb(0 0 0 / 0.3);
		color: #fff;
		font-size: 14px;
		line-height: 1;
		white-space: nowrap;
	}

	.fonts button[aria-checked='true'] {
		background: #fff;
		color: #000;
	}
</style>
