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
	confirmTitle: 'Confirma tu correo',
	/** `{email}` is replaced with the address the code went to. */
	confirmHint: 'Escribe el código que te enviamos a {email}.',
	code: 'Código',
	confirm: 'Confirmar',
	resend: 'Enviar otro código',
	back: 'Volver',
	working: 'Un momento…',
	loading: 'Cargando tus datos…',
	account: 'Cuenta',
	signOut: 'Cerrar sesión',
	notConfiguredTitle: 'Sin base de datos',
	notConfigured:
		'Esta versión se publicó sin la configuración de Neon, así que no hay dónde guardar nada.',

	/**
	 * What Neon Auth answers with, which it says in English, plus what this screen has to say on
	 * its own. Not all of it is a complaint: `notices` lists the ones that are good news.
	 */
	errors: {
		INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
		INVALID_EMAIL: 'Ese correo no es válido.',
		USER_NOT_FOUND: 'No hay ninguna cuenta con ese correo.',
		USER_ALREADY_EXISTS: 'Ya hay una cuenta con ese correo. Entra con ella.',
		PASSWORD_TOO_SHORT: 'La contraseña es demasiado corta.',
		PASSWORD_TOO_LONG: 'La contraseña es demasiado larga.',
		EMAIL_NOT_VERIFIED: 'Confirma tu correo antes de entrar.',
		SESSION_EXPIRED: 'La sesión caducó. Vuelve a entrar.',
		SIGNED_UP: 'Cuenta creada. Si pide confirmación, revisa tu correo y vuelve a entrar.',
		INVALID_OTP: 'Ese código no es el que enviamos.',
		OTP_EXPIRED: 'Ese código ya caducó. Pide otro.',
		TOO_MANY_ATTEMPTS: 'Demasiados intentos. Pide otro código.',
		CODE_SENT: 'Te enviamos otro código.',
		CONFIRMED: 'Cuenta confirmada. Ya puedes entrar.',
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
	confirmTitle: 'Confirm your email',
	confirmHint: 'Type the code we sent to {email}.',
	code: 'Code',
	confirm: 'Confirm',
	resend: 'Send another code',
	back: 'Back',
	working: 'One moment…',
	loading: 'Loading your data…',
	account: 'Account',
	signOut: 'Sign out',
	notConfiguredTitle: 'No database',
	notConfigured:
		'This build was published without the Neon configuration: there is nowhere to save.',

	errors: {
		INVALID_EMAIL_OR_PASSWORD: 'Wrong email or password.',
		INVALID_EMAIL: 'That email is not valid.',
		USER_NOT_FOUND: 'There is no account with that email.',
		USER_ALREADY_EXISTS: 'There is already an account with that email. Sign in with it.',
		PASSWORD_TOO_SHORT: 'That password is too short.',
		PASSWORD_TOO_LONG: 'That password is too long.',
		EMAIL_NOT_VERIFIED: 'Confirm your email before signing in.',
		SESSION_EXPIRED: 'Your session ran out. Sign in again.',
		SIGNED_UP: 'Account created. If it asks for confirmation, check your email and sign in.',
		INVALID_OTP: 'That is not the code we sent.',
		OTP_EXPIRED: 'That code has expired. Ask for another one.',
		TOO_MANY_ATTEMPTS: 'Too many tries. Ask for another code.',
		CODE_SENT: 'Another code is on its way.',
		CONFIRMED: 'Account confirmed. You can sign in now.',
		FAILED: "Couldn't sign in."
	}
};

export const text = { es, en };

/** The two answers above that are not a failure, and are not drawn as one. */
export const notices = ['CODE_SENT', 'CONFIRMED'];
