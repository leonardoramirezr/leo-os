<script lang="ts">
	// One measure over time, a point per session: a 2px line over a faint wash, on hairline gridlines,
	// with the last value written at its end. Touching or hovering the plot finds the nearest session
	// and says its date and value; the arrow keys do the same once it has the focus, and the numbers
	// are also there as a table, so that none of them depends on seeing the line.
	import { formatCompact, formatShortDate } from '$lib/format';
	import type { Point } from '$lib/stats';

	let {
		points,
		title,
		format,
		zero = true
	}: {
		points: Point[];
		/** What is plotted, with its unit: «Volumen (kg)». It names the chart; a single series has no legend. */
		title: string;
		format: (value: number) => string;
		/** Whether the scale starts at zero, as a total should; an average zooms in on where it moves. */
		zero?: boolean;
	} = $props();

	const HEIGHT = 168;
	const MARGIN = { top: 14, right: 16, bottom: 26, left: 44 };

	let width = $state(320);
	let active = $state<number | null>(null);

	const plotWidth = $derived(Math.max(10, width - MARGIN.left - MARGIN.right));
	const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

	/** Tick values that fall on round numbers: 1, 2, 2.5 or 5 times a power of ten. */
	function niceStep(span: number, count: number): number {
		const raw = span / Math.max(1, count);
		const power = 10 ** Math.floor(Math.log10(raw || 1));
		for (const factor of [1, 2, 2.5, 5, 10]) if (raw <= factor * power) return factor * power;
		return 10 * power;
	}

	const domain = $derived.by(() => {
		const values = points.map((point) => point.value);
		let low = zero ? 0 : Math.min(...values);
		let high = Math.max(...values);
		if (high === low) {
			// One value, or several alike: room above and below so the line sits in the middle.
			high = high ? high * 1.25 : 1;
			low = zero || !low ? 0 : low * 0.75;
		}
		const step = niceStep(high - low, 3);
		low = Math.floor(low / step) * step;
		high = Math.ceil(high / step) * step;
		const ticks: number[] = [];
		for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(Number(tick.toFixed(6)));
		return { low, high, ticks };
	});

	const times = $derived({
		start: Math.min(...points.map((point) => point.at)),
		end: Math.max(...points.map((point) => point.at))
	});

	function x(at: number): number {
		if (times.end === times.start) return MARGIN.left + plotWidth / 2;
		return MARGIN.left + ((at - times.start) / (times.end - times.start)) * plotWidth;
	}

	function y(value: number): number {
		const { low, high } = domain;
		return MARGIN.top + plotHeight - ((value - low) / (high - low || 1)) * plotHeight;
	}

	const coordinates = $derived(points.map((point) => ({ ...point, x: x(point.at), y: y(point.value) })));
	const line = $derived(coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(''));
	const area = $derived(
		coordinates.length > 1
			? `${line}L${coordinates.at(-1)!.x},${MARGIN.top + plotHeight}L${coordinates[0].x},${MARGIN.top + plotHeight}Z`
			: ''
	);
	const last = $derived(coordinates.at(-1));
	const shown = $derived(active === null ? undefined : coordinates[active]);

	/** The session nearest the pointer, along the time axis: nobody has to land on a 2px line. */
	function nearest(event: PointerEvent) {
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const pointer = event.clientX - box.left;
		let best = 0;
		coordinates.forEach((point, index) => {
			if (Math.abs(point.x - pointer) < Math.abs(coordinates[best].x - pointer)) best = index;
		});
		active = best;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const from = active ?? coordinates.length - 1;
		const step = event.key === 'ArrowLeft' ? -1 : 1;
		active = Math.min(coordinates.length - 1, Math.max(0, from + step));
	}

	/** What a screen reader hears: from the first value to the last, the table has the rest. */
	const summary = $derived.by(() => {
		const first = points[0];
		const latest = points.at(-1);
		if (!first || !latest) return title;
		if (points.length === 1) return `${title}: una sesión, ${format(first.value)}`;
		const from = `${format(first.value)} el ${formatShortDate(first.at)}`;
		return `${title}: de ${from} a ${format(latest.value)} el ${formatShortDate(latest.at)}`;
	});

	/** Where the tooltip goes: beside the point, on whichever side has room. */
	const tooltipLeft = $derived(shown ? Math.min(Math.max(shown.x, 70), width - 70) : 0);
</script>

<figure class="chart">
	<figcaption>{title}</figcaption>

	{#if points.length}
		<div class="plot" bind:clientWidth={width}>
			<!-- An image to a screen reader, which hears its summary and has the table below; a pointer and
			     the arrow keys explore it. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
			<svg
				{width}
				height={HEIGHT}
				role="img"
				aria-label={summary}
				tabindex="0"
				onpointermove={nearest}
				onpointerdown={nearest}
				onpointerleave={() => (active = null)}
				onfocus={() => (active ??= coordinates.length - 1)}
				onblur={() => (active = null)}
				{onkeydown}
			>
				{#each domain.ticks as tick (tick)}
					<line class="grid" x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(tick)} y2={y(tick)} />
					<text class="tick" x={MARGIN.left - 8} y={y(tick)} text-anchor="end" dominant-baseline="middle">
						{formatCompact(tick)}
					</text>
				{/each}

				<text
					class="tick"
					x={coordinates[0].x}
					y={HEIGHT - 6}
					text-anchor={coordinates.length > 1 ? 'start' : 'middle'}
				>
					{formatShortDate(times.start)}
				</text>
				{#if coordinates.length > 1}
					<text class="tick" x={MARGIN.left + plotWidth} y={HEIGHT - 6} text-anchor="end">
						{formatShortDate(times.end)}
					</text>
				{/if}

				{#if area}<path class="area" d={area} />{/if}
				{#if coordinates.length > 1}<path class="line" d={line} />{/if}

				{#if shown}
					<line class="crosshair" x1={shown.x} x2={shown.x} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
				{/if}

				{#each coordinates as point, index}
					<circle
						class="point"
						class:active={index === active}
						cx={point.x}
						cy={point.y}
						r={index === active ? 5.5 : 4}
					/>
				{/each}

				{#if last && active === null}
					<text
						class="end-label"
						x={Math.min(last.x, MARGIN.left + plotWidth)}
						y={last.y - 12}
						text-anchor={coordinates.length > 1 ? 'end' : 'middle'}
					>
						{format(last.value)}
					</text>
				{/if}
			</svg>

			{#if shown}
				<div class="tooltip" style:left="{tooltipLeft}px" aria-hidden="true">
					<strong>{format(shown.value)}</strong>
					<span>{formatShortDate(shown.at)}</span>
				</div>
			{/if}
		</div>

		<details class="table">
			<summary>Ver datos</summary>
			<table>
				<thead>
					<tr><th scope="col">Fecha</th><th scope="col">{title}</th></tr>
				</thead>
				<tbody>
					{#each points as point}
						<tr><td>{formatShortDate(point.at)}</td><td>{format(point.value)}</td></tr>
					{/each}
				</tbody>
			</table>
		</details>
	{:else}
		<p class="empty">Aún no hay datos.</p>
	{/if}
</figure>

<style>
	.chart {
		margin: 0;
	}

	figcaption {
		margin: 0 0 6px;
		color: var(--muted);
		font-size: 13px;
		font-weight: 600;
	}

	.plot {
		position: relative;
		width: 100%;
	}

	svg {
		display: block;
		overflow: visible;
		outline: none;
		touch-action: pan-y;
	}

	svg:focus-visible {
		outline: 2px solid var(--link);
		outline-offset: 4px;
		border-radius: 4px;
	}

	.grid {
		stroke: var(--grid);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.tick {
		fill: var(--muted);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.area {
		fill: var(--series);
		opacity: 0.1;
	}

	.line {
		fill: none;
		stroke: var(--series);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* A ring in the card's colour keeps each point apart from the line it sits on. */
	.point {
		fill: var(--series);
		stroke: var(--group);
		stroke-width: 2;
	}

	.crosshair {
		stroke: var(--muted);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.end-label {
		fill: var(--text);
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.tooltip {
		position: absolute;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 5px 9px;
		border-radius: 9px;
		background: var(--text);
		color: var(--group);
		font-size: 12px;
		line-height: 1.3;
		pointer-events: none;
		transform: translate(-50%, -100%);
		white-space: nowrap;
	}

	.tooltip strong {
		font-size: 14px;
	}

	.table {
		margin-top: 4px;
		font-size: 13px;
	}

	summary {
		width: fit-content;
		color: var(--link);
		cursor: pointer;
	}

	table {
		width: 100%;
		margin-top: 6px;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	th,
	td {
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		text-align: left;
	}

	th:last-child,
	td:last-child {
		text-align: right;
	}

	th {
		color: var(--muted);
		font-weight: 500;
	}

	.empty {
		margin: 8px 0;
		color: var(--muted);
		font-size: 14px;
	}
</style>
