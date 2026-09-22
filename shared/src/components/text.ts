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
	working: 'Un momento…',
	loading: 'Cargando tus datos…',
	account: 'Cuenta',
	signOut: 'Cerrar sesión',
	notConfiguredTitle: 'Sin base de datos',
	notConfigured:
		'Esta versión se publicó sin la configuración de Neon, así que no hay dónde guardar nada.',

	/** What Neon Auth answers with, which it says in English. */
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
		FAILED: "Couldn't sign in."
	}
};

export const text = { es, en };
