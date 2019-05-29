import { fromEvent, of, combineLatest } from 'rxjs'
import { startWith, map, concatMap, share } from 'rxjs/operators'

import { isValid,  parse, isBefore, isWithinRange, format } from 'date-fns'

export class Field {
  constructor({fieldName, value, error=null}) {
    this.fieldName = fieldName
    this.value = value
    this.validationError = error
  }

  get hasError() {
    return this.validationError != null
  }
}

export class Form {
  constructor({ fields={}, name, errors=[] }) {
    this.fields = fields
    this.name = name
    this.errors = errors
  }

  get hasErrors() {
    return this.errors.length > 0 ||
      Object.values(this.fields)
        .reduce((hasErrors, field) => hasErrors ? hasErrors : field.hasError, false)
  }
}

export class FormValidationError {
  constructor({ fieldName, message }) {
    this.fieldName = fieldName
    this.message = message
  }
}

const formatString = 'YYYY-MM-DD'

export default function startValidation() {
  const isBuyEl = document.getElementById('is_buy')
  const isBuyEvent$ = fromEvent(isBuyEl, 'change').pipe(
    map(event => event.target.checked),
    startWith(isBuyEl.checked),
  )

  const startDateEl = document.getElementById('start')
  const startEvent$ = fromEvent(startDateEl, 'input').pipe(
    map(event => event.target.value),
    startWith(startDateEl.value),
  )

  const endDateEl = document.getElementById('end')
  const endEvent$ = fromEvent(endDateEl, 'input').pipe(
    map(event => event.target.value),
    startWith(endDateEl.value),
  )

  const validDateRange = [parse('2019-05-01'), parse('2019-05-31')]

  const [isBuyField$, startField$, endField$] = getFieldObservables(isBuyEvent$, startEvent$, endEvent$, validDateRange)

  startField$.subscribe(dateInputSubscriber)
  endField$.subscribe(dateInputSubscriber)

  const form$ = buildFormObservable(isBuyField$, startField$, endField$)

  // If there are any form validation errors, add them to the DOM
  const formErrorsEl = document.getElementById('form-errors')
  form$.subscribe(form => {
    while(formErrorsEl.lastChild) {
      formErrorsEl.lastChild.remove()
    }

    for (let error of form.errors) {
      const errorEl = document.createElement('div')
      errorEl.textContent = `Field: ${error.fieldName} - ${error.message}`
      formErrorsEl.appendChild(errorEl)
    }
  })

  return form$
}

function buildFormObservable(isBuyField$, startField$, endField$) {
  return combineLatest(isBuyField$, startField$, endField$).pipe(
    map(fields => Object.freeze(fields.reduce((fieldObj, field) => ({ ...fieldObj, [field.fieldName]: field }), {}))),
    concatMap(fields => {
      const { start, end } = fields
      const startDate = start.value
      const endDate = end.value
      const errors = []

      if (!start.hasError || !end.hasError) {
        if (isBefore(endDate, startDate)) {
          errors.push(Object.freeze(new FormValidationError({ fieldName: end.fieldName, message: 'End date cannot be before the start end' })))
        }
      }

      return of(Object.freeze(new Form({ fields, name: 'filters', errors })))
    }),
  )
}

function dateInputSubscriber(field) {
  const errorEl = document.getElementById(`${field.fieldName}-error`)
  const input = document.getElementById(field.fieldName)
  if (field.hasError) {
    errorEl.textContent = field.validationError
    input.style.borderColor = 'red'
  } else {
    errorEl.textContent = ''
    input.style.borderColor = 'black'
  }
}

function validDateString(validDateRange) {
  return concatMap(([dateString, fieldName]) => {
    const date = parse(dateString)
    if (!isValid(date)) {
      return of(Object.freeze(new Field({fieldName, value: date, error: 'Not a valid date string.'})))
    }
    if (!isWithinRange(date, ...validDateRange)) {
      return of(
        Object.freeze(
          new Field({
            fieldName,
            value: date,
            error: `Date must be between ${format(validDateRange[0], formatString)} and ${format(validDateRange[1], formatString)}`,
          })
        )
      )
    }
    const field = Object.freeze(new Field({fieldName, value: date}))
    return of(field)
  })
}

// Transform input data into a Field object. The Field object will have additional
// information regarding if the input that was emitted is valid or not
function getFieldObservables(isBuy$, start$, end$, validDateRange) {
  return [
    isBuy$.pipe(
      // isBuy doesn't have any validation so we just create a Field object to emit
      map(isBuy => Object.freeze(new Field({ fieldName: 'isBuy', value: isBuy })))
    ),
    start$.pipe(
      map(dateString => [dateString, 'start']),
      validDateString(validDateRange),
    ),
    end$.pipe(
      map(dateString => [dateString, 'end']),
      validDateString(validDateRange),
    ),
  ]
}