// What the sign-in screen and the account panel say. The home screen and «Me deben» are in
// Spanish; WillChat is bilingual and passes its own language through, so these come in both.

export type Lang = 'es' | 'en';

const es = {
	signInTitle: 'Entrar',
	signUpTitle: 'Crear cuenta',
	subtitle: 'Tus datos se guardan en tu cuenta y solo tú puedes verlos.',
	name: 'Nombre',
	email: 'Correo',
	password: 'Contraseña',
	signIn: 'Entrar',
	signUp: 'Crear cuenta',
	toSignUp: '¿No tienes cuenta? Crear una',
	toSignIn: '¿Ya tienes cuenta? Entrar',
	notNow: 'Ahora no',
	working: 'Un momento…',
	loading: 'Cargando tus datos…',
	account: 'Cuenta',
	apps: 'Apps',
	signOut: 'Cerrar sesión',
	notConfiguredTitle: 'Sin base de datos',
	notConfigured:
		'Esta versión se publicó sin la configuración de Neon, así que no hay dónde guardar nada.',

	confirmTitle: 'Confirma tu correo',
	code: 'Código',
	confirm: 'Confirmar',
	resendCode: 'Enviar otro código',
	back: 'Volver',
	/** Under the title, depending on what sent the code: signing up, signing in, or asking again. */
	codeFrom: {
		up: (email: string) =>
			`Te enviamos un código a ${email}. Escríbelo aquí para confirmar tu correo.`,
		in: (email: string) =>
			`Tu correo aún no está confirmado. Escribe el código que te enviamos a ${email}, o pide otro.`,
		again: (email: string) => `Te enviamos otro código a ${email}. Usa el del último correo.`
	},

	/** What Neon Auth answers with, which it says in English. */
	errors: {
		INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
		INVALID_EMAIL: 'Ese correo no es válido.',
		USER_NOT_FOUND: 'No hay ninguna cuenta con ese correo.',
		USER_ALREADY_EXISTS: 'Ya hay una cuenta con ese correo. Entra con ella.',
		PASSWORD_TOO_SHORT: 'La contraseña es demasiado corta.',
		PASSWORD_TOO_LONG: 'La contraseña es demasiado larga.',
		INVALID_OTP: 'Ese código no es correcto.',
		OTP_EXPIRED: 'Ese código ya caducó. Pide otro.',
		TOO_MANY_ATTEMPTS: 'Demasiados intentos con ese código. Pide otro.',
		TOO_MANY_REQUESTS: 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
		SESSION_EXPIRED: 'La sesión caducó. Vuelve a entrar.',
		FAILED: 'No se pudo entrar.'
	} as Record<string, string>
};

const en: typeof es = {
	signInTitle: 'Sign in',
	signUpTitle: 'Create account',
	subtitle: 'Your data is kept in your account and only you can see it.',
	name: 'Name',
	email: 'Email',
	password: 'Password',
	signIn: 'Sign in',
	signUp: 'Create account',
	toSignUp: "Don't have an account? Create one",
	toSignIn: 'Already have an account? Sign in',
	notNow: 'Not now',
	working: 'One moment…',
	loading: 'Loading your data…',
	account: 'Account',
	apps: 'Apps',
	signOut: 'Sign out',
	notConfiguredTitle: 'No database',
	notConfigured:
		'This build was published without the Neon configuration: there is nowhere to save.',

	confirmTitle: 'Confirm your email',
	code: 'Code',
	confirm: 'Confirm',
	resendCode: 'Send another code',
	back: 'Back',
	codeFrom: {
		up: (email: string) => `We sent a code to ${email}. Type it here to confirm your email.`,
		in: (email: string) =>
			`Your email isn't confirmed yet. Type the code we sent to ${email}, or ask for another one.`,
		again: (email: string) => `We sent another code to ${email}. Use the one in the latest email.`
	},

	errors: {
		INVALID_EMAIL_OR_PASSWORD: 'Wrong email or password.',
		INVALID_EMAIL: 'That email is not valid.',
		USER_NOT_FOUND: 'There is no account with that email.',
		USER_ALREADY_EXISTS: 'There is already an account with that email. Sign in with it.',
		PASSWORD_TOO_SHORT: 'That password is too short.',
		PASSWORD_TOO_LONG: 'That password is too long.',
		INVALID_OTP: "That code isn't right.",
		OTP_EXPIRED: 'That code has expired. Ask for another one.',
		TOO_MANY_ATTEMPTS: 'Too many tries with that code. Ask for another one.',
		TOO_MANY_REQUESTS: 'Too many tries in a row. Wait a minute and try again.',
		SESSION_EXPIRED: 'Your session ran out. Sign in again.',
		FAILED: "Couldn't sign in."
	}
};

export const text = { es, en };
