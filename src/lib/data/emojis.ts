export type SkinTone = 'default' | 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';

export interface Emoji {
	char: string;
	name: string;
	keywords: string[];
	supportsSkinTone?: boolean;
}

export interface EmojiCategory {
	id: string;
	name: string;
	icon: string;
	emojis: Emoji[];
}

const skinToneModifiers: Record<Exclude<SkinTone, 'default'>, string> = {
	light: '\u{1F3FB}',
	'medium-light': '\u{1F3FC}',
	medium: '\u{1F3FD}',
	'medium-dark': '\u{1F3FE}',
	dark: '\u{1F3FF}'
};

export function applySkinTone(emoji: string, skinTone: SkinTone): string {
	if (skinTone === 'default') return emoji;

	// Insert skin tone modifier after the base emoji character
	// For most emojis, we insert the modifier after the first character
	const modifier = skinToneModifiers[skinTone];
	const codePoints = Array.from(emoji);

	// Check if emoji already has a skin tone modifier
	const hasSkinTone = codePoints.some((cp) => Object.values(skinToneModifiers).includes(cp));

	if (hasSkinTone) {
		// Replace existing skin tone
		return codePoints
			.map((cp) => {
				if (Object.values(skinToneModifiers).includes(cp)) {
					return modifier;
				}
				return cp;
			})
			.join('');
	}

	// Insert skin tone after first code point
	codePoints.splice(1, 0, modifier);
	return codePoints.join('');
}

export const emojiCategories: EmojiCategory[] = [
	{
		id: 'recent',
		name: 'Recently Used',
		icon: '🕐',
		emojis: []
	},
	{
		id: 'people',
		name: 'People & Body',
		icon: '👋',
		emojis: [
			// Hand gestures
			{
				char: '👋',
				name: 'waving hand',
				keywords: [
					'wave',
					'hands',
					'gesture',
					'goodbye',
					'solong',
					'farewell',
					'hello',
					'hi',
					'palm'
				],
				supportsSkinTone: true
			},
			{
				char: '🤚',
				name: 'raised back of hand',
				keywords: ['fingers', 'backhand'],
				supportsSkinTone: true
			},
			{ char: '🖐️', name: 'hand with fingers splayed', keywords: ['palm'], supportsSkinTone: true },
			{
				char: '✋',
				name: 'raised hand',
				keywords: ['stop', 'high five', 'palm', 'ban'],
				supportsSkinTone: true
			},
			{
				char: '🖖',
				name: 'vulcan salute',
				keywords: ['spock', 'star trek'],
				supportsSkinTone: true
			},
			{ char: '🫱', name: 'rightwards hand', keywords: ['palm', 'offer'], supportsSkinTone: true },
			{ char: '🫲', name: 'leftwards hand', keywords: ['palm', 'offer'], supportsSkinTone: true },
			{ char: '🫳', name: 'palm down hand', keywords: ['drop', 'dismiss'], supportsSkinTone: true },
			{
				char: '🫴',
				name: 'palm up hand',
				keywords: ['beckon', 'catch', 'come'],
				supportsSkinTone: true
			},
			{
				char: '👌',
				name: 'OK hand',
				keywords: ['ok', 'perfect', 'okay', 'accept'],
				supportsSkinTone: true
			},
			{
				char: '🤌',
				name: 'pinched fingers',
				keywords: ['italian', 'ma che vuoi'],
				supportsSkinTone: true
			},
			{ char: '🤏', name: 'pinching hand', keywords: ['tiny', 'small'], supportsSkinTone: true },
			{
				char: '✌️',
				name: 'victory hand',
				keywords: ['v', 'peace', 'deuces'],
				supportsSkinTone: true
			},
			{
				char: '🤞',
				name: 'crossed fingers',
				keywords: ['luck', 'hopeful'],
				supportsSkinTone: true
			},
			{
				char: '🫰',
				name: 'hand with index finger and thumb crossed',
				keywords: ['money', 'expensive'],
				supportsSkinTone: true
			},
			{ char: '🤟', name: 'love-you gesture', keywords: ['ily', 'love'], supportsSkinTone: true },
			{
				char: '🤘',
				name: 'sign of the horns',
				keywords: ['metal', 'rock'],
				supportsSkinTone: true
			},
			{ char: '🤙', name: 'call me hand', keywords: ['shaka'], supportsSkinTone: true },
			{
				char: '👈',
				name: 'backhand index pointing left',
				keywords: ['left'],
				supportsSkinTone: true
			},
			{
				char: '👉',
				name: 'backhand index pointing right',
				keywords: ['right'],
				supportsSkinTone: true
			},
			{ char: '👆', name: 'backhand index pointing up', keywords: ['up'], supportsSkinTone: true },
			{ char: '🖕', name: 'middle finger', keywords: ['fu'], supportsSkinTone: true },
			{
				char: '👇',
				name: 'backhand index pointing down',
				keywords: ['down'],
				supportsSkinTone: true
			},
			{ char: '☝️', name: 'index pointing up', keywords: ['up'], supportsSkinTone: true },
			{
				char: '🫵',
				name: 'index pointing at the viewer',
				keywords: ['you'],
				supportsSkinTone: true
			},
			{
				char: '👍',
				name: 'thumbs up',
				keywords: ['+1', 'like', 'approve', 'ok', 'good', 'agree', 'yes'],
				supportsSkinTone: true
			},
			{
				char: '👎',
				name: 'thumbs down',
				keywords: ['-1', 'dislike', 'bad', 'no'],
				supportsSkinTone: true
			},
			{ char: '✊', name: 'raised fist', keywords: ['power', 'protest'], supportsSkinTone: true },
			{ char: '👊', name: 'oncoming fist', keywords: ['punch', 'attack'], supportsSkinTone: true },
			{ char: '🤛', name: 'left-facing fist', keywords: ['punch'], supportsSkinTone: true },
			{ char: '🤜', name: 'right-facing fist', keywords: ['punch'], supportsSkinTone: true },
			{
				char: '👏',
				name: 'clapping hands',
				keywords: ['praise', 'applause', 'congrats', 'yay'],
				supportsSkinTone: true
			},
			{
				char: '🙌',
				name: 'raising hands',
				keywords: ['hooray', 'celebrate', 'arms'],
				supportsSkinTone: true
			},
			{ char: '🫶', name: 'heart hands', keywords: ['love'], supportsSkinTone: true },
			{ char: '👐', name: 'open hands', keywords: ['hug'], supportsSkinTone: true },
			{
				char: '🤲',
				name: 'palms up together',
				keywords: ['cupped', 'prayer'],
				supportsSkinTone: true
			},
			{
				char: '🤝',
				name: 'handshake',
				keywords: ['deal', 'agreement', 'meeting', 'shake'],
				supportsSkinTone: true
			},
			{
				char: '🙏',
				name: 'folded hands',
				keywords: ['please', 'pray', 'thanks', 'appreciate'],
				supportsSkinTone: true
			},
			{ char: '✍️', name: 'writing hand', keywords: ['write'], supportsSkinTone: true },
			{
				char: '💅',
				name: 'nail polish',
				keywords: ['manicure', 'care', 'beauty'],
				supportsSkinTone: true
			},
			{ char: '🤳', name: 'selfie', keywords: ['phone', 'camera'], supportsSkinTone: true },
			{
				char: '💪',
				name: 'flexed biceps',
				keywords: ['muscle', 'workout', 'strong', 'arm'],
				supportsSkinTone: true
			},
			{ char: '🦾', name: 'mechanical arm', keywords: ['accessibility'], supportsSkinTone: false },
			{ char: '🦿', name: 'mechanical leg', keywords: ['accessibility'], supportsSkinTone: false },
			{ char: '🦵', name: 'leg', keywords: ['kick'], supportsSkinTone: true },
			{ char: '🦶', name: 'foot', keywords: ['stomp'], supportsSkinTone: true },
			{ char: '👂', name: 'ear', keywords: ['hear', 'sound', 'listen'], supportsSkinTone: true },
			{
				char: '🦻',
				name: 'ear with hearing aid',
				keywords: ['accessibility'],
				supportsSkinTone: true
			},
			{ char: '👃', name: 'nose', keywords: ['smell', 'sniff'], supportsSkinTone: true },
			{ char: '🧠', name: 'brain', keywords: ['mind', 'intelligent'], supportsSkinTone: false },
			{
				char: '🫀',
				name: 'anatomical heart',
				keywords: ['health', 'heartbeat'],
				supportsSkinTone: false
			},
			{ char: '🫁', name: 'lungs', keywords: ['breath', 'health'], supportsSkinTone: false },
			{ char: '🦷', name: 'tooth', keywords: ['dentist'], supportsSkinTone: false },
			{ char: '🦴', name: 'bone', keywords: ['skeleton'], supportsSkinTone: false },
			{ char: '👀', name: 'eyes', keywords: ['look', 'watch', 'see'], supportsSkinTone: false },
			{ char: '👁️', name: 'eye', keywords: ['look', 'watch', 'see'], supportsSkinTone: false },
			{ char: '👅', name: 'tongue', keywords: ['taste'], supportsSkinTone: false },
			{ char: '👄', name: 'mouth', keywords: ['kiss', 'lips'], supportsSkinTone: false },
			// Faces
			{ char: '😀', name: 'grinning face', keywords: ['smile', 'happy'], supportsSkinTone: false },
			{
				char: '😃',
				name: 'grinning face with big eyes',
				keywords: ['smile', 'happy'],
				supportsSkinTone: false
			},
			{
				char: '😄',
				name: 'grinning face with smiling eyes',
				keywords: ['smile', 'happy'],
				supportsSkinTone: false
			},
			{
				char: '😁',
				name: 'beaming face with smiling eyes',
				keywords: ['smile', 'happy'],
				supportsSkinTone: false
			},
			{
				char: '😆',
				name: 'grinning squinting face',
				keywords: ['lol', 'laugh'],
				supportsSkinTone: false
			},
			{
				char: '😅',
				name: 'grinning face with sweat',
				keywords: ['nervous', 'awkward'],
				supportsSkinTone: false
			},
			{
				char: '🤣',
				name: 'rolling on the floor laughing',
				keywords: ['rofl', 'lol'],
				supportsSkinTone: false
			},
			{
				char: '😂',
				name: 'face with tears of joy',
				keywords: ['laugh', 'lol', 'funny'],
				supportsSkinTone: false
			},
			{ char: '🙂', name: 'slightly smiling face', keywords: ['smile'], supportsSkinTone: false },
			{
				char: '🙃',
				name: 'upside-down face',
				keywords: ['silly', 'sarcasm'],
				supportsSkinTone: false
			},
			{ char: '🫠', name: 'melting face', keywords: ['hot', 'dying'], supportsSkinTone: false },
			{ char: '😉', name: 'winking face', keywords: ['flirt', 'joke'], supportsSkinTone: false },
			{
				char: '😊',
				name: 'smiling face with smiling eyes',
				keywords: ['blush', 'happy'],
				supportsSkinTone: false
			},
			{
				char: '😇',
				name: 'smiling face with halo',
				keywords: ['angel', 'innocent'],
				supportsSkinTone: false
			},
			{
				char: '🥰',
				name: 'smiling face with hearts',
				keywords: ['love', 'like'],
				supportsSkinTone: false
			},
			{
				char: '😍',
				name: 'smiling face with heart-eyes',
				keywords: ['love', 'crush'],
				supportsSkinTone: false
			},
			{ char: '🤩', name: 'star-struck', keywords: ['amazed', 'wow'], supportsSkinTone: false },
			{
				char: '😘',
				name: 'face blowing a kiss',
				keywords: ['love', 'kiss'],
				supportsSkinTone: false
			},
			{ char: '😗', name: 'kissing face', keywords: ['kiss', 'love'], supportsSkinTone: false },
			{ char: '☺️', name: 'smiling face', keywords: ['happy', 'blush'], supportsSkinTone: false },
			{
				char: '😚',
				name: 'kissing face with closed eyes',
				keywords: ['kiss', 'love'],
				supportsSkinTone: false
			},
			{
				char: '😙',
				name: 'kissing face with smiling eyes',
				keywords: ['kiss', 'love'],
				supportsSkinTone: false
			},
			{
				char: '🥲',
				name: 'smiling face with tear',
				keywords: ['grateful', 'touched'],
				supportsSkinTone: false
			},
			{
				char: '😋',
				name: 'face savoring food',
				keywords: ['yum', 'tasty', 'delicious'],
				supportsSkinTone: false
			},
			{
				char: '😛',
				name: 'face with tongue',
				keywords: ['silly', 'playful'],
				supportsSkinTone: false
			},
			{
				char: '😜',
				name: 'winking face with tongue',
				keywords: ['silly', 'playful', 'joke'],
				supportsSkinTone: false
			},
			{ char: '🤪', name: 'zany face', keywords: ['crazy', 'silly'], supportsSkinTone: false },
			{
				char: '😝',
				name: 'squinting face with tongue',
				keywords: ['silly', 'playful'],
				supportsSkinTone: false
			},
			{
				char: '🤑',
				name: 'money-mouth face',
				keywords: ['rich', 'dollar', 'cash'],
				supportsSkinTone: false
			},
			{
				char: '🤗',
				name: 'smiling face with open hands',
				keywords: ['hug', 'excited'],
				supportsSkinTone: false
			},
			{
				char: '🤭',
				name: 'face with hand over mouth',
				keywords: ['oops', 'shocked'],
				supportsSkinTone: false
			},
			{
				char: '🫢',
				name: 'face with open eyes and hand over mouth',
				keywords: ['shocked', 'surprised'],
				supportsSkinTone: false
			},
			{
				char: '🫣',
				name: 'face with peeking eye',
				keywords: ['peek', 'secret'],
				supportsSkinTone: false
			},
			{ char: '🤫', name: 'shushing face', keywords: ['quiet', 'shh'], supportsSkinTone: false },
			{
				char: '🤔',
				name: 'thinking face',
				keywords: ['hmm', 'think', 'wonder'],
				supportsSkinTone: false
			},
			{
				char: '🫡',
				name: 'saluting face',
				keywords: ['respect', 'salute'],
				supportsSkinTone: false
			},
			{
				char: '🤐',
				name: 'zipper-mouth face',
				keywords: ['silent', 'quiet'],
				supportsSkinTone: false
			},
			{
				char: '🤨',
				name: 'face with raised eyebrow',
				keywords: ['suspicious', 'doubt'],
				supportsSkinTone: false
			},
			{
				char: '😐',
				name: 'neutral face',
				keywords: ['meh', 'indifferent'],
				supportsSkinTone: false
			},
			{ char: '😑', name: 'expressionless face', keywords: ['blank'], supportsSkinTone: false },
			{
				char: '😶',
				name: 'face without mouth',
				keywords: ['silent', 'quiet'],
				supportsSkinTone: false
			},
			{
				char: '🫥',
				name: 'dotted line face',
				keywords: ['invisible', 'hidden'],
				supportsSkinTone: false
			},
			{ char: '😏', name: 'smirking face', keywords: ['smug', 'flirt'], supportsSkinTone: false },
			{ char: '😒', name: 'unamused face', keywords: ['meh', 'annoyed'], supportsSkinTone: false },
			{
				char: '🙄',
				name: 'face with rolling eyes',
				keywords: ['eyeroll', 'disappointed'],
				supportsSkinTone: false
			},
			{
				char: '😬',
				name: 'grimacing face',
				keywords: ['nervous', 'awkward'],
				supportsSkinTone: false
			},
			{ char: '🤥', name: 'lying face', keywords: ['liar', 'pinocchio'], supportsSkinTone: false },
			{ char: '😌', name: 'relieved face', keywords: ['peace', 'relax'], supportsSkinTone: false },
			{ char: '😔', name: 'pensive face', keywords: ['sad', 'depressed'], supportsSkinTone: false },
			{
				char: '😪',
				name: 'sleepy face',
				keywords: ['tired', 'exhausted'],
				supportsSkinTone: false
			},
			{ char: '🤤', name: 'drooling face', keywords: ['sleep', 'desire'], supportsSkinTone: false },
			{ char: '😴', name: 'sleeping face', keywords: ['tired', 'zzz'], supportsSkinTone: false },
			{
				char: '😷',
				name: 'face with medical mask',
				keywords: ['sick', 'ill', 'covid'],
				supportsSkinTone: false
			},
			{
				char: '🤒',
				name: 'face with thermometer',
				keywords: ['sick', 'fever'],
				supportsSkinTone: false
			},
			{
				char: '🤕',
				name: 'face with head-bandage',
				keywords: ['hurt', 'injured'],
				supportsSkinTone: false
			},
			{ char: '🤢', name: 'nauseated face', keywords: ['sick', 'vomit'], supportsSkinTone: false },
			{
				char: '🤮',
				name: 'face vomiting',
				keywords: ['sick', 'throw up'],
				supportsSkinTone: false
			},
			{ char: '🤧', name: 'sneezing face', keywords: ['sick', 'allergy'], supportsSkinTone: false },
			{ char: '🥵', name: 'hot face', keywords: ['sweat', 'warm'], supportsSkinTone: false },
			{ char: '🥶', name: 'cold face', keywords: ['freezing', 'ice'], supportsSkinTone: false },
			{ char: '🥴', name: 'woozy face', keywords: ['dizzy', 'drunk'], supportsSkinTone: false },
			{
				char: '😵',
				name: 'face with crossed-out eyes',
				keywords: ['dizzy', 'dead'],
				supportsSkinTone: false
			},
			{
				char: '🤯',
				name: 'exploding head',
				keywords: ['mind blown', 'shocked'],
				supportsSkinTone: false
			},
			{
				char: '🤠',
				name: 'cowboy hat face',
				keywords: ['western', 'country'],
				supportsSkinTone: false
			},
			{
				char: '🥳',
				name: 'partying face',
				keywords: ['celebrate', 'party'],
				supportsSkinTone: false
			},
			{
				char: '🥸',
				name: 'disguised face',
				keywords: ['incognito', 'glasses'],
				supportsSkinTone: false
			},
			{
				char: '😎',
				name: 'smiling face with sunglasses',
				keywords: ['cool', 'awesome'],
				supportsSkinTone: false
			},
			{ char: '🤓', name: 'nerd face', keywords: ['geek', 'glasses'], supportsSkinTone: false },
			{
				char: '🧐',
				name: 'face with monocle',
				keywords: ['suspicious', 'detective'],
				supportsSkinTone: false
			},
			{
				char: '😕',
				name: 'confused face',
				keywords: ['uncertain', 'puzzled'],
				supportsSkinTone: false
			},
			{
				char: '🫤',
				name: 'face with diagonal mouth',
				keywords: ['skeptical', 'unsure'],
				supportsSkinTone: false
			},
			{
				char: '😟',
				name: 'worried face',
				keywords: ['concerned', 'nervous'],
				supportsSkinTone: false
			},
			{
				char: '🙁',
				name: 'slightly frowning face',
				keywords: ['sad', 'disappointed'],
				supportsSkinTone: false
			},
			{ char: '☹️', name: 'frowning face', keywords: ['sad', 'unhappy'], supportsSkinTone: false },
			{
				char: '😮',
				name: 'face with open mouth',
				keywords: ['surprise', 'shocked'],
				supportsSkinTone: false
			},
			{
				char: '😯',
				name: 'hushed face',
				keywords: ['quiet', 'surprised'],
				supportsSkinTone: false
			},
			{
				char: '😲',
				name: 'astonished face',
				keywords: ['shocked', 'amazed'],
				supportsSkinTone: false
			},
			{ char: '😳', name: 'flushed face', keywords: ['blush', 'shy'], supportsSkinTone: false },
			{
				char: '🥺',
				name: 'pleading face',
				keywords: ['puppy eyes', 'beg'],
				supportsSkinTone: false
			},
			{
				char: '🥹',
				name: 'face holding back tears',
				keywords: ['touched', 'grateful'],
				supportsSkinTone: false
			},
			{
				char: '😦',
				name: 'frowning face with open mouth',
				keywords: ['shocked', 'surprised'],
				supportsSkinTone: false
			},
			{
				char: '😧',
				name: 'anguished face',
				keywords: ['pain', 'suffering'],
				supportsSkinTone: false
			},
			{
				char: '😨',
				name: 'fearful face',
				keywords: ['scared', 'terrified'],
				supportsSkinTone: false
			},
			{
				char: '😰',
				name: 'anxious face with sweat',
				keywords: ['nervous', 'worried'],
				supportsSkinTone: false
			},
			{
				char: '😥',
				name: 'sad but relieved face',
				keywords: ['phew', 'whew'],
				supportsSkinTone: false
			},
			{ char: '😢', name: 'crying face', keywords: ['tears', 'sad'], supportsSkinTone: false },
			{
				char: '😭',
				name: 'loudly crying face',
				keywords: ['tears', 'sob'],
				supportsSkinTone: false
			},
			{
				char: '😱',
				name: 'face screaming in fear',
				keywords: ['scream', 'horror'],
				supportsSkinTone: false
			},
			{
				char: '😖',
				name: 'confounded face',
				keywords: ['frustrated', 'upset'],
				supportsSkinTone: false
			},
			{
				char: '😣',
				name: 'persevering face',
				keywords: ['struggle', 'effort'],
				supportsSkinTone: false
			},
			{
				char: '😞',
				name: 'disappointed face',
				keywords: ['sad', 'depressed'],
				supportsSkinTone: false
			},
			{
				char: '😓',
				name: 'downcast face with sweat',
				keywords: ['sad', 'disappointed'],
				supportsSkinTone: false
			},
			{ char: '😩', name: 'weary face', keywords: ['tired', 'exhausted'], supportsSkinTone: false },
			{
				char: '😫',
				name: 'tired face',
				keywords: ['exhausted', 'fed up'],
				supportsSkinTone: false
			},
			{ char: '🥱', name: 'yawning face', keywords: ['tired', 'sleepy'], supportsSkinTone: false },
			{
				char: '😤',
				name: 'face with steam from nose',
				keywords: ['angry', 'mad'],
				supportsSkinTone: false
			},
			{
				char: '😡',
				name: 'pouting face',
				keywords: ['angry', 'mad', 'furious'],
				supportsSkinTone: false
			},
			{ char: '😠', name: 'angry face', keywords: ['mad', 'annoyed'], supportsSkinTone: false },
			{
				char: '🤬',
				name: 'face with symbols on mouth',
				keywords: ['cursing', 'swearing'],
				supportsSkinTone: false
			},
			{
				char: '😈',
				name: 'smiling face with horns',
				keywords: ['devil', 'evil'],
				supportsSkinTone: false
			},
			{
				char: '👿',
				name: 'angry face with horns',
				keywords: ['devil', 'evil', 'mad'],
				supportsSkinTone: false
			},
			{
				char: '💀',
				name: 'skull',
				keywords: ['dead', 'death', 'skeleton'],
				supportsSkinTone: false
			},
			{
				char: '☠️',
				name: 'skull and crossbones',
				keywords: ['pirate', 'danger'],
				supportsSkinTone: false
			},
			{ char: '💩', name: 'pile of poo', keywords: ['poop', 'crap'], supportsSkinTone: false },
			{ char: '🤡', name: 'clown face', keywords: ['funny', 'scary'], supportsSkinTone: false },
			{ char: '👹', name: 'ogre', keywords: ['monster', 'scary'], supportsSkinTone: false },
			{ char: '👺', name: 'goblin', keywords: ['monster', 'scary'], supportsSkinTone: false },
			{ char: '👻', name: 'ghost', keywords: ['halloween', 'spooky'], supportsSkinTone: false },
			{ char: '👽️', name: 'alien', keywords: ['ufo', 'space'], supportsSkinTone: false },
			{
				char: '👾',
				name: 'alien monster',
				keywords: ['game', 'space invader'],
				supportsSkinTone: false
			},
			{ char: '🤖', name: 'robot', keywords: ['ai', 'computer'], supportsSkinTone: false },
			{ char: '😺', name: 'grinning cat', keywords: ['happy', 'smile'], supportsSkinTone: false },
			{
				char: '😸',
				name: 'grinning cat with smiling eyes',
				keywords: ['happy'],
				supportsSkinTone: false
			},
			{
				char: '😹',
				name: 'cat with tears of joy',
				keywords: ['lol', 'laugh'],
				supportsSkinTone: false
			},
			{
				char: '😻',
				name: 'smiling cat with heart-eyes',
				keywords: ['love', 'like'],
				supportsSkinTone: false
			},
			{ char: '😼', name: 'cat with wry smile', keywords: ['smirk'], supportsSkinTone: false },
			{ char: '😽', name: 'kissing cat', keywords: ['kiss', 'love'], supportsSkinTone: false },
			{ char: '🙀', name: 'weary cat', keywords: ['tired', 'exhausted'], supportsSkinTone: false },
			{ char: '😿', name: 'crying cat', keywords: ['sad', 'tears'], supportsSkinTone: false },
			{ char: '😾', name: 'pouting cat', keywords: ['angry', 'mad'], supportsSkinTone: false }
		]
	},
	{
		id: 'nature',
		name: 'Animals & Nature',
		icon: '🌸',
		emojis: [
			{ char: '🐶', name: 'dog face', keywords: ['puppy', 'pet'], supportsSkinTone: false },
			{ char: '🐕', name: 'dog', keywords: ['pet'], supportsSkinTone: false },
			{
				char: '🦮',
				name: 'guide dog',
				keywords: ['blind', 'accessibility'],
				supportsSkinTone: false
			},
			{ char: '🐕‍🦺', name: 'service dog', keywords: ['assistance'], supportsSkinTone: false },
			{ char: '🐩', name: 'poodle', keywords: ['dog'], supportsSkinTone: false },
			{ char: '🐺', name: 'wolf', keywords: ['dog'], supportsSkinTone: false },
			{ char: '🦊', name: 'fox', keywords: ['cute'], supportsSkinTone: false },
			{ char: '🦝', name: 'raccoon', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐱', name: 'cat face', keywords: ['kitten', 'pet'], supportsSkinTone: false },
			{ char: '🐈', name: 'cat', keywords: ['pet'], supportsSkinTone: false },
			{ char: '🐈‍⬛', name: 'black cat', keywords: ['pet'], supportsSkinTone: false },
			{ char: '🦁', name: 'lion', keywords: ['cat'], supportsSkinTone: false },
			{ char: '🐯', name: 'tiger face', keywords: ['cat'], supportsSkinTone: false },
			{ char: '🐅', name: 'tiger', keywords: ['cat'], supportsSkinTone: false },
			{ char: '🐆', name: 'leopard', keywords: ['cat'], supportsSkinTone: false },
			{ char: '🐴', name: 'horse face', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐎', name: 'horse', keywords: ['race'], supportsSkinTone: false },
			{ char: '🦄', name: 'unicorn', keywords: ['magic'], supportsSkinTone: false },
			{ char: '🦓', name: 'zebra', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦌', name: 'deer', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦬', name: 'bison', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐮', name: 'cow face', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐂', name: 'ox', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐃', name: 'water buffalo', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐄', name: 'cow', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐷', name: 'pig face', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐖', name: 'pig', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐗', name: 'boar', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐽', name: 'pig nose', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐏', name: 'ram', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐑', name: 'ewe', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐐', name: 'goat', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐪', name: 'camel', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐫', name: 'two-hump camel', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦙', name: 'llama', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦒', name: 'giraffe', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐘', name: 'elephant', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦣', name: 'mammoth', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦏', name: 'rhinoceros', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦛', name: 'hippopotamus', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐭', name: 'mouse face', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐁', name: 'mouse', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐀', name: 'rat', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐹', name: 'hamster', keywords: ['pet'], supportsSkinTone: false },
			{ char: '🐰', name: 'rabbit face', keywords: ['bunny', 'animal'], supportsSkinTone: false },
			{ char: '🐇', name: 'rabbit', keywords: ['bunny', 'animal'], supportsSkinTone: false },
			{ char: '🐿️', name: 'chipmunk', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦫', name: 'beaver', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦔', name: 'hedgehog', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦇', name: 'bat', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐻', name: 'bear', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐻‍❄️', name: 'polar bear', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐨', name: 'koala', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐼', name: 'panda', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦥', name: 'sloth', keywords: ['lazy', 'slow'], supportsSkinTone: false },
			{ char: '🦦', name: 'otter', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦨', name: 'skunk', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦘', name: 'kangaroo', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦡', name: 'badger', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐾', name: 'paw prints', keywords: ['animal', 'pet'], supportsSkinTone: false },
			{ char: '🦃', name: 'turkey', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🐔', name: 'chicken', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🐓', name: 'rooster', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🐣', name: 'hatching chick', keywords: ['baby', 'bird'], supportsSkinTone: false },
			{ char: '🐤', name: 'baby chick', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🐥', name: 'front-facing baby chick', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🐦', name: 'bird', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐧', name: 'penguin', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🕊️', name: 'dove', keywords: ['bird', 'peace'], supportsSkinTone: false },
			{ char: '🦅', name: 'eagle', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🦆', name: 'duck', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🦢', name: 'swan', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🦉', name: 'owl', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🦤', name: 'dodo', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🪶', name: 'feather', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🦩', name: 'flamingo', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🦚', name: 'peacock', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🦜', name: 'parrot', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🐸', name: 'frog', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐊', name: 'crocodile', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐢', name: 'turtle', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦎', name: 'lizard', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐍', name: 'snake', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐲', name: 'dragon face', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐉', name: 'dragon', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦕', name: 'sauropod', keywords: ['dinosaur'], supportsSkinTone: false },
			{ char: '🦖', name: 'T-Rex', keywords: ['dinosaur'], supportsSkinTone: false },
			{ char: '🐳', name: 'spouting whale', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐋', name: 'whale', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐬', name: 'dolphin', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦭', name: 'seal', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐟', name: 'fish', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐠', name: 'tropical fish', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐡', name: 'blowfish', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦈', name: 'shark', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐙', name: 'octopus', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🐚', name: 'spiral shell', keywords: ['beach'], supportsSkinTone: false },
			{ char: '🪸', name: 'coral', keywords: ['ocean'], supportsSkinTone: false },
			{ char: '🐌', name: 'snail', keywords: ['slow'], supportsSkinTone: false },
			{ char: '🦋', name: 'butterfly', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🐛', name: 'bug', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🐜', name: 'ant', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🐝', name: 'honeybee', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🪲', name: 'beetle', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🐞', name: 'lady beetle', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🦗', name: 'cricket', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🪳', name: 'cockroach', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🕷️', name: 'spider', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🕸️', name: 'spider web', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🦂', name: 'scorpion', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🦟', name: 'mosquito', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🪰', name: 'fly', keywords: ['insect'], supportsSkinTone: false },
			{ char: '🪱', name: 'worm', keywords: ['animal'], supportsSkinTone: false },
			{ char: '🦠', name: 'microbe', keywords: ['germ', 'virus'], supportsSkinTone: false },
			{ char: '💐', name: 'bouquet', keywords: ['flowers'], supportsSkinTone: false },
			{ char: '🌸', name: 'cherry blossom', keywords: ['flower'], supportsSkinTone: false },
			{ char: '💮', name: 'white flower', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🪷', name: 'lotus', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🏵️', name: 'rosette', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🌹', name: 'rose', keywords: ['flower', 'love'], supportsSkinTone: false },
			{ char: '🥀', name: 'wilted flower', keywords: ['dead'], supportsSkinTone: false },
			{ char: '🌺', name: 'hibiscus', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🌻', name: 'sunflower', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🌼', name: 'blossom', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🌷', name: 'tulip', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🪻', name: 'hyacinth', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🌱', name: 'seedling', keywords: ['plant'], supportsSkinTone: false },
			{ char: '🪴', name: 'potted plant', keywords: ['plant'], supportsSkinTone: false },
			{ char: '🌲', name: 'evergreen tree', keywords: ['tree'], supportsSkinTone: false },
			{ char: '🌳', name: 'deciduous tree', keywords: ['tree'], supportsSkinTone: false },
			{ char: '🌴', name: 'palm tree', keywords: ['tree'], supportsSkinTone: false },
			{ char: '🌵', name: 'cactus', keywords: ['plant'], supportsSkinTone: false },
			{ char: '🌾', name: 'sheaf of rice', keywords: ['plant'], supportsSkinTone: false },
			{ char: '🌿', name: 'herb', keywords: ['plant'], supportsSkinTone: false },
			{ char: '☘️', name: 'shamrock', keywords: ['plant'], supportsSkinTone: false },
			{ char: '🍀', name: 'four leaf clover', keywords: ['luck'], supportsSkinTone: false },
			{ char: '🍁', name: 'maple leaf', keywords: ['leaf'], supportsSkinTone: false },
			{ char: '🍂', name: 'fallen leaf', keywords: ['autumn'], supportsSkinTone: false },
			{
				char: '🍃',
				name: 'leaf fluttering in wind',
				keywords: ['nature'],
				supportsSkinTone: false
			},
			{ char: '🪹', name: 'empty nest', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🪺', name: 'nest with eggs', keywords: ['bird'], supportsSkinTone: false },
			{ char: '🍄', name: 'mushroom', keywords: ['fungi'], supportsSkinTone: false }
		]
	},
	{
		id: 'food',
		name: 'Food & Drink',
		icon: '🍕',
		emojis: [
			{ char: '🍇', name: 'grapes', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍈', name: 'melon', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍉', name: 'watermelon', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍊', name: 'tangerine', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍋', name: 'lemon', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍌', name: 'banana', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍍', name: 'pineapple', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🥭', name: 'mango', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍎', name: 'red apple', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍏', name: 'green apple', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍐', name: 'pear', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍑', name: 'peach', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍒', name: 'cherries', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍓', name: 'strawberry', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🫐', name: 'blueberries', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🥝', name: 'kiwi fruit', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍅', name: 'tomato', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🫒', name: 'olive', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥥', name: 'coconut', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🥑', name: 'avocado', keywords: ['fruit'], supportsSkinTone: false },
			{ char: '🍆', name: 'eggplant', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🥔', name: 'potato', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🥕', name: 'carrot', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🌽', name: 'ear of corn', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🌶️', name: 'hot pepper', keywords: ['spicy'], supportsSkinTone: false },
			{ char: '🫑', name: 'bell pepper', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🥒', name: 'cucumber', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🥬', name: 'leafy green', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🥦', name: 'broccoli', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🧄', name: 'garlic', keywords: ['food'], supportsSkinTone: false },
			{ char: '🧅', name: 'onion', keywords: ['vegetable'], supportsSkinTone: false },
			{ char: '🍄', name: 'mushroom', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥜', name: 'peanuts', keywords: ['food'], supportsSkinTone: false },
			{ char: '🫘', name: 'beans', keywords: ['food'], supportsSkinTone: false },
			{ char: '🌰', name: 'chestnut', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍞', name: 'bread', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥐', name: 'croissant', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥖', name: 'baguette bread', keywords: ['food'], supportsSkinTone: false },
			{ char: '🫓', name: 'flatbread', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥨', name: 'pretzel', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥯', name: 'bagel', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥞', name: 'pancakes', keywords: ['food'], supportsSkinTone: false },
			{ char: '🧇', name: 'waffle', keywords: ['food'], supportsSkinTone: false },
			{ char: '🧀', name: 'cheese wedge', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍖', name: 'meat on bone', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍗', name: 'poultry leg', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥩', name: 'cut of meat', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥓', name: 'bacon', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍔', name: 'hamburger', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍟', name: 'french fries', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍕', name: 'pizza', keywords: ['food'], supportsSkinTone: false },
			{ char: '🌭', name: 'hot dog', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥪', name: 'sandwich', keywords: ['food'], supportsSkinTone: false },
			{ char: '🌮', name: 'taco', keywords: ['food'], supportsSkinTone: false },
			{ char: '🌯', name: 'burrito', keywords: ['food'], supportsSkinTone: false },
			{ char: '🫔', name: 'tamale', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥙', name: 'stuffed flatbread', keywords: ['food'], supportsSkinTone: false },
			{ char: '🧆', name: 'falafel', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥚', name: 'egg', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍳', name: 'cooking', keywords: ['egg'], supportsSkinTone: false },
			{ char: '🥘', name: 'shallow pan of food', keywords: ['cooking'], supportsSkinTone: false },
			{ char: '🍲', name: 'pot of food', keywords: ['cooking'], supportsSkinTone: false },
			{ char: '🫕', name: 'fondue', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥣', name: 'bowl with spoon', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥗', name: 'green salad', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍿', name: 'popcorn', keywords: ['food', 'movie'], supportsSkinTone: false },
			{ char: '🧈', name: 'butter', keywords: ['food'], supportsSkinTone: false },
			{ char: '🧂', name: 'salt', keywords: ['seasoning'], supportsSkinTone: false },
			{ char: '🥫', name: 'canned food', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍱', name: 'bento box', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍘', name: 'rice cracker', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍙', name: 'rice ball', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍚', name: 'cooked rice', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍛', name: 'curry rice', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍜', name: 'steaming bowl', keywords: ['noodles'], supportsSkinTone: false },
			{ char: '🍝', name: 'spaghetti', keywords: ['pasta'], supportsSkinTone: false },
			{ char: '🍠', name: 'roasted sweet potato', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍢', name: 'oden', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍣', name: 'sushi', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍤', name: 'fried shrimp', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍥', name: 'fish cake with swirl', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥮', name: 'moon cake', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍡', name: 'dango', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥟', name: 'dumpling', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥠', name: 'fortune cookie', keywords: ['food'], supportsSkinTone: false },
			{ char: '🥡', name: 'takeout box', keywords: ['food'], supportsSkinTone: false },
			{ char: '🦀', name: 'crab', keywords: ['food'], supportsSkinTone: false },
			{ char: '🦞', name: 'lobster', keywords: ['food'], supportsSkinTone: false },
			{ char: '🦐', name: 'shrimp', keywords: ['food'], supportsSkinTone: false },
			{ char: '🦑', name: 'squid', keywords: ['food'], supportsSkinTone: false },
			{ char: '🦪', name: 'oyster', keywords: ['food'], supportsSkinTone: false },
			{ char: '🍦', name: 'soft ice cream', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🍧', name: 'shaved ice', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🍨', name: 'ice cream', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🍩', name: 'doughnut', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🍪', name: 'cookie', keywords: ['dessert'], supportsSkinTone: false },
			{
				char: '🎂',
				name: 'birthday cake',
				keywords: ['dessert', 'party'],
				supportsSkinTone: false
			},
			{ char: '🍰', name: 'shortcake', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🧁', name: 'cupcake', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🥧', name: 'pie', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🍫', name: 'chocolate bar', keywords: ['candy'], supportsSkinTone: false },
			{ char: '🍬', name: 'candy', keywords: ['sweet'], supportsSkinTone: false },
			{ char: '🍭', name: 'lollipop', keywords: ['candy'], supportsSkinTone: false },
			{ char: '🍮', name: 'custard', keywords: ['dessert'], supportsSkinTone: false },
			{ char: '🍯', name: 'honey pot', keywords: ['sweet'], supportsSkinTone: false },
			{ char: '🍼', name: 'baby bottle', keywords: ['milk'], supportsSkinTone: false },
			{ char: '🥛', name: 'glass of milk', keywords: ['drink'], supportsSkinTone: false },
			{ char: '☕', name: 'hot beverage', keywords: ['coffee', 'tea'], supportsSkinTone: false },
			{ char: '🫖', name: 'teapot', keywords: ['tea'], supportsSkinTone: false },
			{
				char: '🍵',
				name: 'teacup without handle',
				keywords: ['tea', 'matcha'],
				supportsSkinTone: false
			},
			{ char: '🍶', name: 'sake', keywords: ['drink'], supportsSkinTone: false },
			{
				char: '🍾',
				name: 'bottle with popping cork',
				keywords: ['champagne', 'celebration'],
				supportsSkinTone: false
			},
			{ char: '🍷', name: 'wine glass', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🍸', name: 'cocktail glass', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🍹', name: 'tropical drink', keywords: ['cocktail'], supportsSkinTone: false },
			{ char: '🍺', name: 'beer mug', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🍻', name: 'clinking beer mugs', keywords: ['cheers'], supportsSkinTone: false },
			{
				char: '🥂',
				name: 'clinking glasses',
				keywords: ['cheers', 'celebration'],
				supportsSkinTone: false
			},
			{
				char: '🥃',
				name: 'tumbler glass',
				keywords: ['drink', 'whiskey'],
				supportsSkinTone: false
			},
			{ char: '🫗', name: 'pouring liquid', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🥤', name: 'cup with straw', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🧋', name: 'bubble tea', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🧃', name: 'beverage box', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🧉', name: 'mate', keywords: ['drink'], supportsSkinTone: false },
			{ char: '🧊', name: 'ice', keywords: ['cold'], supportsSkinTone: false }
		]
	},
	{
		id: 'activities',
		name: 'Activities',
		icon: '⚽',
		emojis: [
			{
				char: '⚽',
				name: 'soccer ball',
				keywords: ['football', 'sports'],
				supportsSkinTone: false
			},
			{ char: '⚾', name: 'baseball', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🥎', name: 'softball', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏀', name: 'basketball', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏐', name: 'volleyball', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏈', name: 'american football', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏉', name: 'rugby football', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🎾', name: 'tennis', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🥏', name: 'flying disc', keywords: ['frisbee', 'sports'], supportsSkinTone: false },
			{ char: '🎳', name: 'bowling', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏏', name: 'cricket game', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏑', name: 'field hockey', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏒', name: 'ice hockey', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🥍', name: 'lacrosse', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏓', name: 'ping pong', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏸', name: 'badminton', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🥊', name: 'boxing glove', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🥋', name: 'martial arts uniform', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🥅', name: 'goal net', keywords: ['sports'], supportsSkinTone: false },
			{ char: '⛳', name: 'flag in hole', keywords: ['golf', 'sports'], supportsSkinTone: false },
			{ char: '⛸️', name: 'ice skate', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🎣', name: 'fishing pole', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🤿', name: 'diving mask', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🎽', name: 'running shirt', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🎿', name: 'skis', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🛷', name: 'sled', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🥌', name: 'curling stone', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🎯', name: 'bullseye', keywords: ['darts'], supportsSkinTone: false },
			{ char: '🪀', name: 'yo-yo', keywords: ['toy'], supportsSkinTone: false },
			{ char: '🪁', name: 'kite', keywords: ['toy'], supportsSkinTone: false },
			{ char: '🔫', name: 'water pistol', keywords: ['toy', 'gun'], supportsSkinTone: false },
			{ char: '🎱', name: 'pool 8 ball', keywords: ['game'], supportsSkinTone: false },
			{ char: '🔮', name: 'crystal ball', keywords: ['fortune'], supportsSkinTone: false },
			{ char: '🪄', name: 'magic wand', keywords: ['magic'], supportsSkinTone: false },
			{
				char: '🎮',
				name: 'video game',
				keywords: ['controller', 'gaming'],
				supportsSkinTone: false
			},
			{ char: '🕹️', name: 'joystick', keywords: ['gaming'], supportsSkinTone: false },
			{ char: '🎰', name: 'slot machine', keywords: ['gambling'], supportsSkinTone: false },
			{ char: '🎲', name: 'game die', keywords: ['dice'], supportsSkinTone: false },
			{ char: '🧩', name: 'puzzle piece', keywords: ['game'], supportsSkinTone: false },
			{ char: '🧸', name: 'teddy bear', keywords: ['toy'], supportsSkinTone: false },
			{ char: '🪅', name: 'piñata', keywords: ['party'], supportsSkinTone: false },
			{ char: '🪩', name: 'mirror ball', keywords: ['disco'], supportsSkinTone: false },
			{ char: '🪆', name: 'nesting dolls', keywords: ['toy'], supportsSkinTone: false },
			{ char: '♠️', name: 'spade suit', keywords: ['cards'], supportsSkinTone: false },
			{ char: '♥️', name: 'heart suit', keywords: ['cards'], supportsSkinTone: false },
			{ char: '♦️', name: 'diamond suit', keywords: ['cards'], supportsSkinTone: false },
			{ char: '♣️', name: 'club suit', keywords: ['cards'], supportsSkinTone: false },
			{ char: '♟️', name: 'chess pawn', keywords: ['game'], supportsSkinTone: false },
			{ char: '🃏', name: 'joker', keywords: ['cards'], supportsSkinTone: false },
			{ char: '🀄', name: 'mahjong red dragon', keywords: ['game'], supportsSkinTone: false },
			{ char: '🎴', name: 'flower playing cards', keywords: ['game'], supportsSkinTone: false },
			{
				char: '🎭',
				name: 'performing arts',
				keywords: ['theater', 'drama'],
				supportsSkinTone: false
			},
			{ char: '🖼️', name: 'framed picture', keywords: ['art'], supportsSkinTone: false },
			{ char: '🎨', name: 'artist palette', keywords: ['art', 'paint'], supportsSkinTone: false },
			{ char: '🧵', name: 'thread', keywords: ['sewing'], supportsSkinTone: false },
			{ char: '🪡', name: 'sewing needle', keywords: ['sewing'], supportsSkinTone: false },
			{ char: '🧶', name: 'yarn', keywords: ['knitting'], supportsSkinTone: false },
			{ char: '🪢', name: 'knot', keywords: ['rope'], supportsSkinTone: false }
		]
	},
	{
		id: 'travel',
		name: 'Travel & Places',
		icon: '🚗',
		emojis: [
			{
				char: '🌍',
				name: 'globe showing Europe-Africa',
				keywords: ['earth', 'world'],
				supportsSkinTone: false
			},
			{
				char: '🌎',
				name: 'globe showing Americas',
				keywords: ['earth', 'world'],
				supportsSkinTone: false
			},
			{
				char: '🌏',
				name: 'globe showing Asia-Australia',
				keywords: ['earth', 'world'],
				supportsSkinTone: false
			},
			{
				char: '🌐',
				name: 'globe with meridians',
				keywords: ['earth', 'internet'],
				supportsSkinTone: false
			},
			{ char: '🗺️', name: 'world map', keywords: ['travel'], supportsSkinTone: false },
			{ char: '🗾', name: 'map of Japan', keywords: ['country'], supportsSkinTone: false },
			{ char: '🧭', name: 'compass', keywords: ['navigation'], supportsSkinTone: false },
			{ char: '🏔️', name: 'snow-capped mountain', keywords: ['nature'], supportsSkinTone: false },
			{ char: '⛰️', name: 'mountain', keywords: ['nature'], supportsSkinTone: false },
			{ char: '🌋', name: 'volcano', keywords: ['nature'], supportsSkinTone: false },
			{ char: '🗻', name: 'mount fuji', keywords: ['mountain'], supportsSkinTone: false },
			{ char: '🏕️', name: 'camping', keywords: ['outdoors'], supportsSkinTone: false },
			{ char: '🏖️', name: 'beach with umbrella', keywords: ['vacation'], supportsSkinTone: false },
			{ char: '🏜️', name: 'desert', keywords: ['nature'], supportsSkinTone: false },
			{ char: '🏝️', name: 'desert island', keywords: ['vacation'], supportsSkinTone: false },
			{ char: '🏞️', name: 'national park', keywords: ['nature'], supportsSkinTone: false },
			{ char: '🏟️', name: 'stadium', keywords: ['sports'], supportsSkinTone: false },
			{
				char: '🏛️',
				name: 'classical building',
				keywords: ['architecture'],
				supportsSkinTone: false
			},
			{ char: '🏗️', name: 'building construction', keywords: ['crane'], supportsSkinTone: false },
			{ char: '🧱', name: 'brick', keywords: ['wall'], supportsSkinTone: false },
			{ char: '🪨', name: 'rock', keywords: ['stone'], supportsSkinTone: false },
			{ char: '🪵', name: 'wood', keywords: ['log'], supportsSkinTone: false },
			{ char: '🛖', name: 'hut', keywords: ['house'], supportsSkinTone: false },
			{ char: '🏘️', name: 'houses', keywords: ['buildings'], supportsSkinTone: false },
			{ char: '🏚️', name: 'derelict house', keywords: ['abandoned'], supportsSkinTone: false },
			{ char: '🏠', name: 'house', keywords: ['home'], supportsSkinTone: false },
			{ char: '🏡', name: 'house with garden', keywords: ['home'], supportsSkinTone: false },
			{ char: '🏢', name: 'office building', keywords: ['work'], supportsSkinTone: false },
			{ char: '🏣', name: 'Japanese post office', keywords: ['mail'], supportsSkinTone: false },
			{ char: '🏤', name: 'post office', keywords: ['mail'], supportsSkinTone: false },
			{ char: '🏥', name: 'hospital', keywords: ['medical', 'health'], supportsSkinTone: false },
			{ char: '🏦', name: 'bank', keywords: ['money'], supportsSkinTone: false },
			{ char: '🏨', name: 'hotel', keywords: ['accommodation'], supportsSkinTone: false },
			{ char: '🏩', name: 'love hotel', keywords: ['romance'], supportsSkinTone: false },
			{ char: '🏪', name: 'convenience store', keywords: ['shop'], supportsSkinTone: false },
			{ char: '🏫', name: 'school', keywords: ['education'], supportsSkinTone: false },
			{ char: '🏬', name: 'department store', keywords: ['shop'], supportsSkinTone: false },
			{ char: '🏭', name: 'factory', keywords: ['industry'], supportsSkinTone: false },
			{ char: '🏯', name: 'Japanese castle', keywords: ['building'], supportsSkinTone: false },
			{ char: '🏰', name: 'castle', keywords: ['building'], supportsSkinTone: false },
			{ char: '💒', name: 'wedding', keywords: ['marriage'], supportsSkinTone: false },
			{ char: '🗼', name: 'Tokyo tower', keywords: ['landmark'], supportsSkinTone: false },
			{ char: '🗽', name: 'Statue of Liberty', keywords: ['landmark'], supportsSkinTone: false },
			{ char: '⛪', name: 'church', keywords: ['religion'], supportsSkinTone: false },
			{ char: '🕌', name: 'mosque', keywords: ['religion'], supportsSkinTone: false },
			{ char: '🛕', name: 'hindu temple', keywords: ['religion'], supportsSkinTone: false },
			{ char: '🕍', name: 'synagogue', keywords: ['religion'], supportsSkinTone: false },
			{ char: '⛩️', name: 'shinto shrine', keywords: ['religion'], supportsSkinTone: false },
			{ char: '🕋', name: 'kaaba', keywords: ['religion'], supportsSkinTone: false },
			{ char: '⛲', name: 'fountain', keywords: ['water'], supportsSkinTone: false },
			{ char: '⛺', name: 'tent', keywords: ['camping'], supportsSkinTone: false },
			{ char: '🌁', name: 'foggy', keywords: ['weather'], supportsSkinTone: false },
			{ char: '🌃', name: 'night with stars', keywords: ['city'], supportsSkinTone: false },
			{ char: '🏙️', name: 'cityscape', keywords: ['buildings'], supportsSkinTone: false },
			{
				char: '🌄',
				name: 'sunrise over mountains',
				keywords: ['morning'],
				supportsSkinTone: false
			},
			{ char: '🌅', name: 'sunrise', keywords: ['morning'], supportsSkinTone: false },
			{ char: '🌆', name: 'cityscape at dusk', keywords: ['evening'], supportsSkinTone: false },
			{ char: '🌇', name: 'sunset', keywords: ['evening'], supportsSkinTone: false },
			{ char: '🌉', name: 'bridge at night', keywords: ['travel'], supportsSkinTone: false },
			{ char: '♨️', name: 'hot springs', keywords: ['onsen'], supportsSkinTone: false },
			{ char: '🎠', name: 'carousel horse', keywords: ['amusement'], supportsSkinTone: false },
			{ char: '🛝', name: 'playground slide', keywords: ['fun'], supportsSkinTone: false },
			{ char: '🎡', name: 'ferris wheel', keywords: ['amusement'], supportsSkinTone: false },
			{ char: '🎢', name: 'roller coaster', keywords: ['amusement'], supportsSkinTone: false },
			{ char: '💈', name: 'barber pole', keywords: ['haircut'], supportsSkinTone: false },
			{ char: '🎪', name: 'circus tent', keywords: ['carnival'], supportsSkinTone: false },
			{ char: '🚂', name: 'locomotive', keywords: ['train'], supportsSkinTone: false },
			{ char: '🚃', name: 'railway car', keywords: ['train'], supportsSkinTone: false },
			{ char: '🚄', name: 'high-speed train', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚅', name: 'bullet train', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚆', name: 'train', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚇', name: 'metro', keywords: ['subway'], supportsSkinTone: false },
			{ char: '🚈', name: 'light rail', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚉', name: 'station', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚊', name: 'tram', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚝', name: 'monorail', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚞', name: 'mountain railway', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚋', name: 'tram car', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚌', name: 'bus', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚍', name: 'oncoming bus', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚎', name: 'trolleybus', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚐', name: 'minibus', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚑', name: 'ambulance', keywords: ['emergency'], supportsSkinTone: false },
			{ char: '🚒', name: 'fire engine', keywords: ['emergency'], supportsSkinTone: false },
			{ char: '🚓', name: 'police car', keywords: ['emergency'], supportsSkinTone: false },
			{ char: '🚔', name: 'oncoming police car', keywords: ['emergency'], supportsSkinTone: false },
			{ char: '🚕', name: 'taxi', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚖', name: 'oncoming taxi', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚗', name: 'automobile', keywords: ['car'], supportsSkinTone: false },
			{ char: '🚘', name: 'oncoming automobile', keywords: ['car'], supportsSkinTone: false },
			{ char: '🚙', name: 'sport utility vehicle', keywords: ['car'], supportsSkinTone: false },
			{ char: '🛻', name: 'pickup truck', keywords: ['car'], supportsSkinTone: false },
			{ char: '🚚', name: 'delivery truck', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚛', name: 'articulated lorry', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚜', name: 'tractor', keywords: ['vehicle'], supportsSkinTone: false },
			{ char: '🏎️', name: 'racing car', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🏍️', name: 'motorcycle', keywords: ['vehicle'], supportsSkinTone: false },
			{ char: '🛵', name: 'motor scooter', keywords: ['vehicle'], supportsSkinTone: false },
			{
				char: '🦽',
				name: 'manual wheelchair',
				keywords: ['accessibility'],
				supportsSkinTone: false
			},
			{
				char: '🦼',
				name: 'motorized wheelchair',
				keywords: ['accessibility'],
				supportsSkinTone: false
			},
			{ char: '🛺', name: 'auto rickshaw', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚲', name: 'bicycle', keywords: ['bike'], supportsSkinTone: false },
			{ char: '🛴', name: 'kick scooter', keywords: ['vehicle'], supportsSkinTone: false },
			{ char: '🛹', name: 'skateboard', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🛼', name: 'roller skate', keywords: ['sports'], supportsSkinTone: false },
			{ char: '🚏', name: 'bus stop', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🛣️', name: 'motorway', keywords: ['road'], supportsSkinTone: false },
			{ char: '🛤️', name: 'railway track', keywords: ['train'], supportsSkinTone: false },
			{ char: '🛢️', name: 'oil drum', keywords: ['fuel'], supportsSkinTone: false },
			{ char: '⛽', name: 'fuel pump', keywords: ['gas'], supportsSkinTone: false },
			{ char: '🛞', name: 'wheel', keywords: ['vehicle'], supportsSkinTone: false },
			{ char: '🚨', name: 'police car light', keywords: ['emergency'], supportsSkinTone: false },
			{
				char: '🚥',
				name: 'horizontal traffic light',
				keywords: ['signal'],
				supportsSkinTone: false
			},
			{ char: '🚦', name: 'vertical traffic light', keywords: ['signal'], supportsSkinTone: false },
			{ char: '🛑', name: 'stop sign', keywords: ['traffic'], supportsSkinTone: false },
			{ char: '🚧', name: 'construction', keywords: ['warning'], supportsSkinTone: false },
			{ char: '⚓', name: 'anchor', keywords: ['ship'], supportsSkinTone: false },
			{ char: '🛟', name: 'ring buoy', keywords: ['life preserver'], supportsSkinTone: false },
			{ char: '⛵', name: 'sailboat', keywords: ['boat'], supportsSkinTone: false },
			{ char: '🛶', name: 'canoe', keywords: ['boat'], supportsSkinTone: false },
			{ char: '🚤', name: 'speedboat', keywords: ['boat'], supportsSkinTone: false },
			{ char: '🛳️', name: 'passenger ship', keywords: ['cruise'], supportsSkinTone: false },
			{ char: '⛴️', name: 'ferry', keywords: ['boat'], supportsSkinTone: false },
			{ char: '🛥️', name: 'motor boat', keywords: ['boat'], supportsSkinTone: false },
			{ char: '🚢', name: 'ship', keywords: ['boat'], supportsSkinTone: false },
			{ char: '✈️', name: 'airplane', keywords: ['flight'], supportsSkinTone: false },
			{ char: '🛩️', name: 'small airplane', keywords: ['flight'], supportsSkinTone: false },
			{ char: '🛫', name: 'airplane departure', keywords: ['flight'], supportsSkinTone: false },
			{ char: '🛬', name: 'airplane arrival', keywords: ['flight'], supportsSkinTone: false },
			{ char: '🪂', name: 'parachute', keywords: ['skydive'], supportsSkinTone: false },
			{ char: '💺', name: 'seat', keywords: ['chair'], supportsSkinTone: false },
			{ char: '🚁', name: 'helicopter', keywords: ['flight'], supportsSkinTone: false },
			{ char: '🚟', name: 'suspension railway', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚠', name: 'mountain cableway', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🚡', name: 'aerial tramway', keywords: ['transport'], supportsSkinTone: false },
			{ char: '🛰️', name: 'satellite', keywords: ['space'], supportsSkinTone: false },
			{ char: '🚀', name: 'rocket', keywords: ['space'], supportsSkinTone: false },
			{ char: '🛸', name: 'flying saucer', keywords: ['ufo'], supportsSkinTone: false },
			{ char: '🛎️', name: 'bellhop bell', keywords: ['hotel'], supportsSkinTone: false },
			{ char: '🧳', name: 'luggage', keywords: ['travel'], supportsSkinTone: false }
		]
	},
	{
		id: 'objects',
		name: 'Objects',
		icon: '💡',
		emojis: [
			{ char: '⌚', name: 'watch', keywords: ['time'], supportsSkinTone: false },
			{ char: '📱', name: 'mobile phone', keywords: ['smartphone'], supportsSkinTone: false },
			{ char: '📲', name: 'mobile phone with arrow', keywords: ['call'], supportsSkinTone: false },
			{ char: '💻', name: 'laptop', keywords: ['computer'], supportsSkinTone: false },
			{ char: '⌨️', name: 'keyboard', keywords: ['computer'], supportsSkinTone: false },
			{ char: '🖥️', name: 'desktop computer', keywords: ['computer'], supportsSkinTone: false },
			{ char: '🖨️', name: 'printer', keywords: ['computer'], supportsSkinTone: false },
			{ char: '🖱️', name: 'computer mouse', keywords: ['click'], supportsSkinTone: false },
			{ char: '🖲️', name: 'trackball', keywords: ['computer'], supportsSkinTone: false },
			{ char: '🕹️', name: 'joystick', keywords: ['gaming'], supportsSkinTone: false },
			{ char: '🗜️', name: 'clamp', keywords: ['tool'], supportsSkinTone: false },
			{ char: '💽', name: 'computer disk', keywords: ['save'], supportsSkinTone: false },
			{ char: '💾', name: 'floppy disk', keywords: ['save'], supportsSkinTone: false },
			{ char: '💿', name: 'optical disk', keywords: ['cd'], supportsSkinTone: false },
			{ char: '📀', name: 'dvd', keywords: ['disk'], supportsSkinTone: false },
			{ char: '📼', name: 'videocassette', keywords: ['vhs'], supportsSkinTone: false },
			{ char: '📷', name: 'camera', keywords: ['photo'], supportsSkinTone: false },
			{ char: '📸', name: 'camera with flash', keywords: ['photo'], supportsSkinTone: false },
			{ char: '📹', name: 'video camera', keywords: ['film'], supportsSkinTone: false },
			{ char: '🎥', name: 'movie camera', keywords: ['film'], supportsSkinTone: false },
			{ char: '📽️', name: 'film projector', keywords: ['movie'], supportsSkinTone: false },
			{ char: '🎞️', name: 'film frames', keywords: ['movie'], supportsSkinTone: false },
			{ char: '📞', name: 'telephone receiver', keywords: ['phone'], supportsSkinTone: false },
			{ char: '☎️', name: 'telephone', keywords: ['phone'], supportsSkinTone: false },
			{ char: '📟', name: 'pager', keywords: ['device'], supportsSkinTone: false },
			{ char: '📠', name: 'fax machine', keywords: ['device'], supportsSkinTone: false },
			{ char: '📺', name: 'television', keywords: ['tv'], supportsSkinTone: false },
			{ char: '📻', name: 'radio', keywords: ['music'], supportsSkinTone: false },
			{ char: '🎙️', name: 'studio microphone', keywords: ['recording'], supportsSkinTone: false },
			{ char: '🎚️', name: 'level slider', keywords: ['audio'], supportsSkinTone: false },
			{ char: '🎛️', name: 'control knobs', keywords: ['audio'], supportsSkinTone: false },
			{ char: '🧭', name: 'compass', keywords: ['navigation'], supportsSkinTone: false },
			{ char: '⏱️', name: 'stopwatch', keywords: ['timer'], supportsSkinTone: false },
			{ char: '⏲️', name: 'timer clock', keywords: ['alarm'], supportsSkinTone: false },
			{ char: '⏰', name: 'alarm clock', keywords: ['morning'], supportsSkinTone: false },
			{ char: '🕰️', name: 'mantelpiece clock', keywords: ['time'], supportsSkinTone: false },
			{ char: '⌛', name: 'hourglass done', keywords: ['time'], supportsSkinTone: false },
			{ char: '⏳', name: 'hourglass not done', keywords: ['time'], supportsSkinTone: false },
			{ char: '📡', name: 'satellite antenna', keywords: ['signal'], supportsSkinTone: false },
			{ char: '🔋', name: 'battery', keywords: ['power'], supportsSkinTone: false },
			{ char: '🪫', name: 'low battery', keywords: ['power'], supportsSkinTone: false },
			{ char: '🔌', name: 'electric plug', keywords: ['power'], supportsSkinTone: false },
			{ char: '💡', name: 'light bulb', keywords: ['idea'], supportsSkinTone: false },
			{ char: '🔦', name: 'flashlight', keywords: ['light'], supportsSkinTone: false },
			{ char: '🕯️', name: 'candle', keywords: ['light'], supportsSkinTone: false },
			{ char: '🪔', name: 'diya lamp', keywords: ['light'], supportsSkinTone: false },
			{ char: '🧯', name: 'fire extinguisher', keywords: ['safety'], supportsSkinTone: false },
			{ char: '🛢️', name: 'oil drum', keywords: ['fuel'], supportsSkinTone: false },
			{
				char: '💸',
				name: 'money with wings',
				keywords: ['cash', 'dollar'],
				supportsSkinTone: false
			},
			{ char: '💵', name: 'dollar banknote', keywords: ['money'], supportsSkinTone: false },
			{ char: '💴', name: 'yen banknote', keywords: ['money'], supportsSkinTone: false },
			{ char: '💶', name: 'euro banknote', keywords: ['money'], supportsSkinTone: false },
			{ char: '💷', name: 'pound banknote', keywords: ['money'], supportsSkinTone: false },
			{ char: '🪙', name: 'coin', keywords: ['money'], supportsSkinTone: false },
			{ char: '💰', name: 'money bag', keywords: ['cash', 'dollar'], supportsSkinTone: false },
			{ char: '💳', name: 'credit card', keywords: ['money'], supportsSkinTone: false },
			{ char: '💎', name: 'gem stone', keywords: ['diamond'], supportsSkinTone: false },
			{ char: '⚖️', name: 'balance scale', keywords: ['law', 'justice'], supportsSkinTone: false },
			{ char: '🦯', name: 'white cane', keywords: ['accessibility'], supportsSkinTone: false },
			{ char: '🧰', name: 'toolbox', keywords: ['tools'], supportsSkinTone: false },
			{ char: '🔧', name: 'wrench', keywords: ['tool'], supportsSkinTone: false },
			{ char: '🪛', name: 'screwdriver', keywords: ['tool'], supportsSkinTone: false },
			{ char: '🔩', name: 'nut and bolt', keywords: ['tool'], supportsSkinTone: false },
			{ char: '⚙️', name: 'gear', keywords: ['settings'], supportsSkinTone: false },
			{ char: '🗑️', name: 'wastebasket', keywords: ['trash'], supportsSkinTone: false },
			{ char: '🛢️', name: 'oil drum', keywords: ['fuel'], supportsSkinTone: false },
			{ char: '⛓️', name: 'chains', keywords: ['link'], supportsSkinTone: false },
			{ char: '🪝', name: 'hook', keywords: ['tool'], supportsSkinTone: false },
			{ char: '🧲', name: 'magnet', keywords: ['attract'], supportsSkinTone: false },
			{ char: '🪜', name: 'ladder', keywords: ['tool'], supportsSkinTone: false },
			{ char: '⚔️', name: 'crossed swords', keywords: ['weapon'], supportsSkinTone: false },
			{ char: '🛡️', name: 'shield', keywords: ['protection'], supportsSkinTone: false },
			{ char: '🪚', name: 'carpentry saw', keywords: ['tool'], supportsSkinTone: false },
			{ char: '🔫', name: 'water pistol', keywords: ['toy'], supportsSkinTone: false },
			{ char: '🪛', name: 'screwdriver', keywords: ['tool'], supportsSkinTone: false },
			{ char: '🗡️', name: 'dagger', keywords: ['weapon'], supportsSkinTone: false },
			{ char: '⚔️', name: 'crossed swords', keywords: ['weapon'], supportsSkinTone: false },
			{ char: '🛡️', name: 'shield', keywords: ['protection'], supportsSkinTone: false },
			{ char: '🪜', name: 'ladder', keywords: ['tool'], supportsSkinTone: false },
			{ char: '🧱', name: 'brick', keywords: ['wall'], supportsSkinTone: false }
		]
	},
	{
		id: 'symbols',
		name: 'Symbols',
		icon: '❤️',
		emojis: [
			{ char: '❤️', name: 'red heart', keywords: ['love', 'like'], supportsSkinTone: false },
			{ char: '🧡', name: 'orange heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '💛', name: 'yellow heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '💚', name: 'green heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '💙', name: 'blue heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '💜', name: 'purple heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '🖤', name: 'black heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '🤍', name: 'white heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '🤎', name: 'brown heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '💔', name: 'broken heart', keywords: ['sad'], supportsSkinTone: false },
			{ char: '❤️‍🔥', name: 'heart on fire', keywords: ['love'], supportsSkinTone: false },
			{ char: '❤️‍🩹', name: 'mending heart', keywords: ['healing'], supportsSkinTone: false },
			{ char: '❣️', name: 'heart exclamation', keywords: ['love'], supportsSkinTone: false },
			{ char: '💕', name: 'two hearts', keywords: ['love'], supportsSkinTone: false },
			{ char: '💞', name: 'revolving hearts', keywords: ['love'], supportsSkinTone: false },
			{ char: '💓', name: 'beating heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '💗', name: 'growing heart', keywords: ['love'], supportsSkinTone: false },
			{ char: '💖', name: 'sparkling heart', keywords: ['love'], supportsSkinTone: false },
			{
				char: '💘',
				name: 'heart with arrow',
				keywords: ['love', 'cupid'],
				supportsSkinTone: false
			},
			{ char: '💝', name: 'heart with ribbon', keywords: ['love'], supportsSkinTone: false },
			{ char: '💟', name: 'heart decoration', keywords: ['love'], supportsSkinTone: false },
			{ char: '☮️', name: 'peace symbol', keywords: ['peace'], supportsSkinTone: false },
			{ char: '✝️', name: 'latin cross', keywords: ['religion'], supportsSkinTone: false },
			{ char: '☪️', name: 'star and crescent', keywords: ['religion'], supportsSkinTone: false },
			{ char: '🕉️', name: 'om', keywords: ['religion'], supportsSkinTone: false },
			{ char: '☸️', name: 'wheel of dharma', keywords: ['religion'], supportsSkinTone: false },
			{ char: '✡️', name: 'star of David', keywords: ['religion'], supportsSkinTone: false },
			{
				char: '🔯',
				name: 'dotted six-pointed star',
				keywords: ['fortune'],
				supportsSkinTone: false
			},
			{ char: '🕎', name: 'menorah', keywords: ['religion'], supportsSkinTone: false },
			{ char: '☯️', name: 'yin yang', keywords: ['balance'], supportsSkinTone: false },
			{ char: '☦️', name: 'orthodox cross', keywords: ['religion'], supportsSkinTone: false },
			{ char: '🛐', name: 'place of worship', keywords: ['religion'], supportsSkinTone: false },
			{ char: '⛎', name: 'Ophiuchus', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♈', name: 'Aries', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♉', name: 'Taurus', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♊', name: 'Gemini', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♋', name: 'Cancer', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♌', name: 'Leo', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♍', name: 'Virgo', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♎', name: 'Libra', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♏', name: 'Scorpio', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♐', name: 'Sagittarius', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♑', name: 'Capricorn', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♒', name: 'Aquarius', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '♓', name: 'Pisces', keywords: ['zodiac'], supportsSkinTone: false },
			{ char: '🆔', name: 'ID button', keywords: ['identity'], supportsSkinTone: false },
			{ char: '⚛️', name: 'atom symbol', keywords: ['science'], supportsSkinTone: false },
			{ char: '🉑', name: 'Japanese acceptable button', keywords: ['ok'], supportsSkinTone: false },
			{ char: '☢️', name: 'radioactive', keywords: ['danger'], supportsSkinTone: false },
			{ char: '☣️', name: 'biohazard', keywords: ['danger'], supportsSkinTone: false },
			{ char: '📴', name: 'mobile phone off', keywords: ['silent'], supportsSkinTone: false },
			{ char: '📳', name: 'vibration mode', keywords: ['phone'], supportsSkinTone: false },
			{
				char: '🈶',
				name: 'Japanese not free of charge button',
				keywords: ['pay'],
				supportsSkinTone: false
			},
			{
				char: '🈚',
				name: 'Japanese free of charge button',
				keywords: ['free'],
				supportsSkinTone: false
			},
			{
				char: '🈸',
				name: 'Japanese application button',
				keywords: ['apply'],
				supportsSkinTone: false
			},
			{
				char: '🈺',
				name: 'Japanese open for business button',
				keywords: ['open'],
				supportsSkinTone: false
			},
			{
				char: '🈷️',
				name: 'Japanese monthly amount button',
				keywords: ['month'],
				supportsSkinTone: false
			},
			{ char: '✴️', name: 'eight-pointed star', keywords: ['star'], supportsSkinTone: false },
			{ char: '🆚', name: 'VS button', keywords: ['versus'], supportsSkinTone: false },
			{ char: '💮', name: 'white flower', keywords: ['flower'], supportsSkinTone: false },
			{ char: '🉐', name: 'Japanese bargain button', keywords: ['deal'], supportsSkinTone: false },
			{ char: '㊙️', name: 'Japanese secret button', keywords: ['secret'], supportsSkinTone: false },
			{
				char: '㊗️',
				name: 'Japanese congratulations button',
				keywords: ['congrats'],
				supportsSkinTone: false
			},
			{
				char: '🈴',
				name: 'Japanese passing grade button',
				keywords: ['pass'],
				supportsSkinTone: false
			},
			{
				char: '🈵',
				name: 'Japanese no vacancy button',
				keywords: ['full'],
				supportsSkinTone: false
			},
			{ char: '🈹', name: 'Japanese discount button', keywords: ['sale'], supportsSkinTone: false },
			{
				char: '🈲',
				name: 'Japanese prohibited button',
				keywords: ['forbidden'],
				supportsSkinTone: false
			},
			{ char: '🅰️', name: 'A button (blood type)', keywords: ['blood'], supportsSkinTone: false },
			{ char: '🅱️', name: 'B button (blood type)', keywords: ['blood'], supportsSkinTone: false },
			{ char: '🆎', name: 'AB button (blood type)', keywords: ['blood'], supportsSkinTone: false },
			{ char: '🆑', name: 'CL button', keywords: ['clear'], supportsSkinTone: false },
			{ char: '🅾️', name: 'O button (blood type)', keywords: ['blood'], supportsSkinTone: false },
			{ char: '🆘', name: 'SOS button', keywords: ['emergency'], supportsSkinTone: false },
			{ char: '❌', name: 'cross mark', keywords: ['no', 'wrong'], supportsSkinTone: false },
			{ char: '⭕', name: 'heavy large circle', keywords: ['yes', 'ok'], supportsSkinTone: false },
			{ char: '🛑', name: 'stop sign', keywords: ['halt'], supportsSkinTone: false },
			{ char: '⛔', name: 'no entry', keywords: ['forbidden'], supportsSkinTone: false },
			{ char: '📛', name: 'name badge', keywords: ['tag'], supportsSkinTone: false },
			{ char: '🚫', name: 'prohibited', keywords: ['forbidden', 'no'], supportsSkinTone: false },
			{
				char: '💯',
				name: 'hundred points',
				keywords: ['perfect', 'score'],
				supportsSkinTone: false
			},
			{ char: '💢', name: 'anger symbol', keywords: ['angry', 'mad'], supportsSkinTone: false },
			{ char: '♨️', name: 'hot springs', keywords: ['onsen'], supportsSkinTone: false },
			{ char: '🚷', name: 'no pedestrians', keywords: ['forbidden'], supportsSkinTone: false },
			{ char: '🚯', name: 'no littering', keywords: ['forbidden'], supportsSkinTone: false },
			{ char: '🚳', name: 'no bicycles', keywords: ['forbidden'], supportsSkinTone: false },
			{ char: '🚱', name: 'non-potable water', keywords: ['warning'], supportsSkinTone: false },
			{ char: '🔞', name: 'no one under eighteen', keywords: ['adults'], supportsSkinTone: false },
			{ char: '📵', name: 'no mobile phones', keywords: ['forbidden'], supportsSkinTone: false },
			{ char: '🚭', name: 'no smoking', keywords: ['forbidden'], supportsSkinTone: false },
			{
				char: '❗',
				name: 'heavy exclamation mark',
				keywords: ['warning'],
				supportsSkinTone: false
			},
			{
				char: '❕',
				name: 'white exclamation mark',
				keywords: ['warning'],
				supportsSkinTone: false
			},
			{ char: '❓', name: 'question mark', keywords: ['question'], supportsSkinTone: false },
			{ char: '❔', name: 'white question mark', keywords: ['question'], supportsSkinTone: false },
			{
				char: '‼️',
				name: 'double exclamation mark',
				keywords: ['warning'],
				supportsSkinTone: false
			},
			{
				char: '⁉️',
				name: 'exclamation question mark',
				keywords: ['question'],
				supportsSkinTone: false
			},
			{ char: '🔅', name: 'low brightness', keywords: ['dim'], supportsSkinTone: false },
			{ char: '🔆', name: 'high brightness', keywords: ['bright'], supportsSkinTone: false },
			{ char: '〽️', name: 'part alternation mark', keywords: ['music'], supportsSkinTone: false },
			{ char: '⚠️', name: 'warning', keywords: ['caution'], supportsSkinTone: false },
			{ char: '🚸', name: 'children crossing', keywords: ['school'], supportsSkinTone: false },
			{ char: '🔱', name: 'trident emblem', keywords: ['poseidon'], supportsSkinTone: false },
			{ char: '⚜️', name: 'fleur-de-lis', keywords: ['decorative'], supportsSkinTone: false },
			{
				char: '🔰',
				name: 'Japanese symbol for beginner',
				keywords: ['new'],
				supportsSkinTone: false
			},
			{ char: '♻️', name: 'recycling symbol', keywords: ['environment'], supportsSkinTone: false },
			{
				char: '✅',
				name: 'white check mark',
				keywords: ['check', 'done'],
				supportsSkinTone: false
			},
			{
				char: '🈯',
				name: 'Japanese reserved button',
				keywords: ['booked'],
				supportsSkinTone: false
			},
			{
				char: '💹',
				name: 'chart increasing with yen',
				keywords: ['money'],
				supportsSkinTone: false
			},
			{ char: '❇️', name: 'sparkle', keywords: ['star'], supportsSkinTone: false },
			{ char: '✳️', name: 'eight-spoked asterisk', keywords: ['star'], supportsSkinTone: false },
			{ char: '❎', name: 'cross mark button', keywords: ['no'], supportsSkinTone: false },
			{ char: '🌐', name: 'globe with meridians', keywords: ['internet'], supportsSkinTone: false },
			{ char: '💠', name: 'diamond with a dot', keywords: ['cute'], supportsSkinTone: false },
			{ char: 'Ⓜ️', name: 'circled M', keywords: ['metro'], supportsSkinTone: false },
			{ char: '🌀', name: 'cyclone', keywords: ['swirl'], supportsSkinTone: false },
			{ char: '💤', name: 'zzz', keywords: ['sleep'], supportsSkinTone: false },
			{ char: '🏧', name: 'ATM sign', keywords: ['bank'], supportsSkinTone: false },
			{ char: '🚾', name: 'water closet', keywords: ['bathroom'], supportsSkinTone: false },
			{
				char: '♿',
				name: 'wheelchair symbol',
				keywords: ['accessibility'],
				supportsSkinTone: false
			},
			{ char: '🅿️', name: 'P button', keywords: ['parking'], supportsSkinTone: false },
			{ char: '🈳', name: 'Japanese vacancy button', keywords: ['empty'], supportsSkinTone: false },
			{
				char: '🈂',
				name: 'Japanese service charge button',
				keywords: ['service'],
				supportsSkinTone: false
			},
			{ char: '🛂', name: 'passport control', keywords: ['travel'], supportsSkinTone: false },
			{ char: '🛃', name: 'customs', keywords: ['travel'], supportsSkinTone: false },
			{ char: '🛄', name: 'baggage claim', keywords: ['travel'], supportsSkinTone: false },
			{ char: '🛅', name: 'left luggage', keywords: ['travel'], supportsSkinTone: false }
		]
	},
	{
		id: 'flags',
		name: 'Flags',
		icon: '🏳️',
		emojis: [
			{ char: '🏳️', name: 'white flag', keywords: ['surrender'], supportsSkinTone: false },
			{ char: '🏴', name: 'black flag', keywords: ['pirate'], supportsSkinTone: false },
			{ char: '🏴‍☠️', name: 'pirate flag', keywords: ['skull'], supportsSkinTone: false },
			{ char: '🏁', name: 'chequered flag', keywords: ['finish'], supportsSkinTone: false },
			{ char: '🚩', name: 'triangular flag', keywords: ['mark'], supportsSkinTone: false },
			{ char: '🏳️‍🌈', name: 'rainbow flag', keywords: ['pride'], supportsSkinTone: false },
			{ char: '🏳️‍⚧️', name: 'transgender flag', keywords: ['pride'], supportsSkinTone: false },
			{ char: '🏴‍☠️', name: 'pirate flag', keywords: ['skull'], supportsSkinTone: false }
		]
	}
];

// All emojis for search
export const allEmojis = emojiCategories.flatMap((cat) => cat.emojis);

// Search emojis by query
export function searchEmojis(query: string): Emoji[] {
	const normalizedQuery = query.toLowerCase().trim();
	if (!normalizedQuery) return [];

	return allEmojis.filter((emoji) => {
		const nameMatch = emoji.name.toLowerCase().includes(normalizedQuery);
		const keywordMatch = emoji.keywords.some((k) => k.toLowerCase().includes(normalizedQuery));
		return nameMatch || keywordMatch;
	});
}

// Get emoji by character
export function getEmojiByChar(char: string): Emoji | undefined {
	return allEmojis.find((e) => e.char === char);
}

// Get category by ID
export function getCategoryById(id: string): EmojiCategory | undefined {
	return emojiCategories.find((cat) => cat.id === id);
}
