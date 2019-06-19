import { fromEvent, of, combineLatest } from 'rxjs'
import { startWith, map, concatMap, tap } from 'rxjs/operators'

import { isValid, parse, isBefore, isWithinRange, format } from 'date-fns'

export class Field {
  constructor({ fieldName, value, error = null }) {
    this.fieldName = fieldName
    this.value = value
    this.validationError = error
  }

  get hasError() {
    return this.validationError != null
  }
}

export class Form {
  constructor({ fields = {}, name, errors = [] }) {
    this.fields = fields
    this.name = name
    this.errors = errors
  }

  get hasErrors() {
    return (
      this.errors.length > 0 ||
      Object.values(this.fields).reduce(
        (hasErrors, field) => (hasErrors ? hasErrors : field.hasError),
        false
      )
    )
  }
}

export class FormValidationError {
  constructor({ fieldName, message }) {
    this.fieldName = fieldName
    this.message = message
  }
}

const formatString = 'YYYY-MM-DD'

function buildFormObservable(transactionTypeField$, startField$, endField$) {
  return combineLatest(transactionTypeField$, startField$, endField$).pipe(
    map(fields =>
      Object.freeze(
        fields.reduce(
          (fieldObj, field) => ({ ...fieldObj, [field.fieldName]: field }),
          {}
        )
      )
    ),
    concatMap(fields => {
      const { start, end } = fields
      const startDate = start.value
      const endDate = end.value
      const errors = []

      if (!start.hasError || !end.hasError) {
        if (isBefore(endDate, startDate)) {
          errors.push(
            Object.freeze(
              new FormValidationError({
                fieldName: end.fieldName,
                message: 'End date cannot be before the start date',
              })
            )
          )
        }
      }

      return of(Object.freeze(new Form({ fields, name: 'filters', errors })))
    })
  )
}

function fieldValidationSideEffect(field) {
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
      return of(
        Object.freeze(
          new Field({
            fieldName,
            value: date,
            error: 'Not a valid date string.',
          })
        )
      )
    }
    if (!isWithinRange(date, ...validDateRange)) {
      return of(
        Object.freeze(
          new Field({
            fieldName,
            value: date,
            error: `Date must be between ${format(
              validDateRange[0],
              formatString
            )} and ${format(validDateRange[1], formatString)}`,
          })
        )
      )
    }
    return of(Object.freeze(new Field({ fieldName, value: date })))
  })
}

export default function startValidation() {
  const transactionsTypeEl = document.getElementById('transaction-type')
  const transactionTypeField$ = fromEvent(transactionsTypeEl, 'change').pipe(
    map(event => event.target.value),
    startWith(transactionsTypeEl.value),
    map(transactionType =>
      Object.freeze(
        new Field({ fieldName: 'transaction-type', value: transactionType })
      )
    )
  )

  const validDateRange = [parse('2019-05-01'), parse('2019-05-31')]

  const startDateEl = document.getElementById('start')
  const startField$ = fromEvent(startDateEl, 'input').pipe(
    map(event => event.target.value),
    startWith(startDateEl.value),
    map(dateString => [dateString, 'start']),
    validDateString(validDateRange),
    tap(fieldValidationSideEffect)
  )

  const endDateEl = document.getElementById('end')
  const endField$ = fromEvent(endDateEl, 'input').pipe(
    map(event => event.target.value),
    startWith(endDateEl.value),
    map(dateString => [dateString, 'end']),
    validDateString(validDateRange),
    tap(fieldValidationSideEffect)
  )

  const formErrorsEl = document.getElementById('form-errors')

  return buildFormObservable(
    transactionTypeField$,
    startField$,
    endField$
  ).pipe(
    // Form validation side effect
    tap(form => {
      while (formErrorsEl.lastChild) {
        formErrorsEl.lastChild.remove()
      }

      for (let error of form.errors) {
        const errorEl = document.createElement('div')
        errorEl.textContent = `Field: ${error.fieldName} - ${error.message}`
        formErrorsEl.appendChild(errorEl)
      }
    })
  )
}
