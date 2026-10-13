import type { Attachment } from 'svelte/attachments';

/**
 * iOS Safari doesn't shrink the layout when the keyboard opens, so a screen is sized to what's
 * visible: otherwise the keyboard covers its bottom, the chat's composer for one.
 */
export const fitViewport: Attachment<HTMLElement> = (element) => {
	const viewport = window.visualViewport;
	const fit = () => {
		if (!viewport || viewport.scale > 1.01) {
			element.style.height = '';
			element.style.transform = '';
		} else {
			element.style.height = `${viewport.height}px`;
			element.style.transform = `translateY(${viewport.offsetTop}px)`;
		}
	};
	fit();
	viewport?.addEventListener('resize', fit);
	viewport?.addEventListener('scroll', fit);

	return () => {
		viewport?.removeEventListener('resize', fit);
		viewport?.removeEventListener('scroll', fit);
	};
};
