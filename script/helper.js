import { Debug } from "./class.js";

const elements = (() => {
	/** @type {Object.<string, HTMLElement>} */
	const cache = {};
	/**
	 * @param {string} selector 
	 * @returns {HTMLElement|null}
	 */
	const get = (selector) => cache[selector] ??= document.querySelector(selector);

	return {
		get topBar() { return get('#topBar') },
		get socialLinks() { return get('#socialLinks') },
		get tableSelect() { return get('#tableSelect') },
		get videoContainer() { return get('#videoContainer') },
		get videoNotice() { return get('#videoNotice') },
		get videoPlayer() { return get('#videoPlayer') },
		get platformLink() { return get('#platformLink') },
		get actionBar() { return get('#actionBar') },
		get searchBox() { return get('#searchBox') },
		get rowCount() { return get('#rowCount') },
		get toggleLayout() { return get('#toggleLayout') },
		get tableContainer() { return get('#tableContainer') },
	}
})();

/**
 * @param {{socials: Object.<string, string>}} param0
 */
function setupSocialLinks({socials}) {
	const sites = {
		Twitter: {url: id => `https://x.com/${id}`, icon: '../img/x.png'},
		YouTube: {url: id => `https://www.youtube.com/channel/${id}`, icon: '../img/youtube.png'},
		TwitCasting: {url: id => `https://twitcasting.tv/${id}`, icon: '../img/twitcasting.png'},
	};
	const fragment = document.createDocumentFragment();

	for (const [key, id] of Object.entries(socials)) {
		if (!id) continue;
		
		const site = sites[key];
		if (!site) continue;

		const anchor = createChild(fragment, 'a');
		anchor.href = site.url(id);
		anchor.target = '_blank';
		anchor.rel = 'noopener noreferrer';

		const img = createChild(anchor, 'img');
		img.src = site.icon;
		img.alt = key;
	}

	elements.socialLinks.replaceChildren(fragment);
}

/**
 * @param {{tables: string[]}} param0
 */
function setupTableSelect({tables}) {
	Debug.startLabel();
	const fragment = document.createDocumentFragment();

	const legend = createChild(fragment, 'legend');
	legend.textContent = 'Table select';

	for (const [i, name] of tables.entries()) {
		const label = createChild(fragment, 'label');
		const radio = createChild(label, 'input');

		Object.assign(radio, {
			type: 'radio',
			name: 'table',
			value: name,
			checked: i === 0
		});

		label.append(name.toUpperCase());
	}

	elements.tableSelect.replaceChildren(fragment);
}

/**
 * @param {string} url
 * @param {boolean} autoPlay
 */
function setVideoUrl(url, autoPlay=false) {
	Debug.startLabel(url, autoPlay);
	const platforms = {
		/**
		 * @param {URL} parsed
		 * @returns {string}
		 */
		'www.youtube.com': parsed => {
			const {v, t} = Object.fromEntries(parsed.searchParams);
			return `https://www.youtube.com/embed/${v}?start=${parseInt(t ?? '0')}&autoplay=${Number(autoPlay)}`;
		},
		/**
		 * @param {URL} parsed
		 * @returns {string}
		 */
		'twitcasting.tv': parsed => {
			const [, userId, , videoId] = parsed.pathname.split('/'); // ['', userId, 'movie', videoId]
			const t = parseInt(parsed.searchParams.get('t') ?? '0');
			return `https://twitcasting.tv/${userId}/embeddedplayer/${videoId}?t=${t}&auto_play=${Number(autoPlay)}`;
		}
	};
	const parsedUrl = new URL(url);
	/** @type {Function | undefined} */
	const convert = platforms[parsedUrl.hostname];
	if (!convert) return;

	elements.videoPlayer.src = convert(parsedUrl);

	setPlatformLink(url);
	if (elements.videoContainer.classList.contains('closed'))
		elements.toggleLayout.dispatchEvent(new Event('click'));
}

/** @param {string} url */
function setPlatformLink(url) {
	Debug.startLabel();
	const platforms = {
		'www.youtube.com': 'YouTube',
		'twitcasting.tv': 'TwitCasting'
	};
	const parsedUrl = new URL(url);

	const fragment = document.createDocumentFragment();
	const anchor = createChild(fragment, 'a');
	Object.assign(anchor, {
		textContent: `${platforms[parsedUrl.hostname] ?? '元サイト'}で開く`,
		href: parsedUrl.href,
		target: '_blank',
		rel: 'noopener noreferrer'
	});

	elements.platformLink.replaceChildren(fragment);
}

/** @param {URLSearchParams} searchParams  */
function setDebugMode(searchParams) {
	const level = Number(searchParams.get('debug')) || 0;
	Debug.setLevel(level);

	if (!level) return;

	const div = createChild(elements.topBar, 'div');
	Object.assign(div.style, {
		position: 'absolute',
		top: '20px',
		right: '20px',
		padding: '10px',
		'z-index': 999,
		backgroundColor: 'cyan'
	});
	div.textContent = 'ログ表示'
	div.addEventListener(
		'click',
		Debug.logOutput
	);
}

function showElements(...keys) {
	Debug.startLabel(keys);

	for (const key of keys) {
		/** @type {HTMLElement | undefined} */
		const element = elements[key];
		if (!element) {
			Debug.warn(`Unknown element: ${key}`);
			continue;
		}

		element.hidden = false;
	}
}

export const Helper = {
	elements,
	setupSocialLinks,
	setupTableSelect,
	setVideoUrl,
	showElements,
	setDebugMode,
};

/**
 * @param {HTMLElement} parent 
 * @param {string} tag 
 * @returns {HTMLElement}
 */
export function createChild(parent, tag) {
	const child = document.createElement(tag);
	parent.appendChild(child);
	return child;
}

/**
 * @param {Function} fn 
 * @param {number} limit 
 * @returns {Function}
 */
export function once(fn, limit=1) {
	let count = 0;
	return function(...args) {
		if (count >= limit) return false;
		count++;
		return fn.apply(this, args);
	};
}

/**
 * @param {Function} fn 
 * @param {number} delay 
 * @returns {Function}
 */
export function debounce(fn, delay=300) {
	let timer;
	return function(...args) {
		clearTimeout(timer);
		timer = setTimeout(() => fn.apply(this, args), delay);
	};
}