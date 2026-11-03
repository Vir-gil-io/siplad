/**
 * SIPLAD — Validacion del mensaje de commit.
 *
 * Convierte la politica de nomenclatura documentada en
 * docs/01-politicas-control-versiones.md en una regla que el repositorio
 * impone: un mensaje que no cumpla la convencion no llega a crearse.
 *
 * Formato exigido:   tipo(alcance): descripcion en minusculas
 * Ejemplo valido:    feat(planeacion): registrar planeacion por parcial
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Tipos admitidos: los mismos que la nomenclatura de ramas del proyecto.
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'test', 'refactor', 'ci', 'chore', 'style', 'perf'],
    ],

    // El tipo es obligatorio y se escribe en minusculas.
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],

    // El alcance es opcional, pero si se indica va en minusculas.
    'scope-case': [2, 'always', 'lower-case'],

    // La descripcion es obligatoria, no empieza con mayuscula y no lleva
    // punto final. Se prohiben las formas con mayuscula inicial en lugar de
    // exigir minusculas estrictas, para que las siglas tecnicas (JWT, OAuth2,
    // API, PDF) puedan escribirse como se escriben.
    'subject-empty': [2, 'never'],
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    'subject-full-stop': [2, 'never', '.'],

    // Longitud: suficiente para describir el cambio, no tanta que se corte en
    // la salida de git log.
    'header-max-length': [2, 'always', 100],
    'header-min-length': [2, 'always', 15],

    // Separacion obligatoria entre encabezado, cuerpo y pie.
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
  },

  // Mensaje de ayuda que se muestra cuando la validacion falla.
  helpUrl:
    'https://www.conventionalcommits.org/es/v1.0.0/ — vease tambien docs/01-politicas-control-versiones.md',
};
