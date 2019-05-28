import { fromEvent, of, combineLatest } from 'rxjs'
import { startWith, map, concatMap, tap } from 'rxjs/operators'

import { isValid,  parse, isBefore, isWithinRange, format } from 'date-fns';

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

export default function getValidaters() {
  const isBuy = document.getElementById('is_buy')
  const isBuyDefault = isBuy.checked
  const isBuyEvents = fromEvent(isBuy, 'change').pipe(
    map(event => event.target.checked),
    // startWith is used to emit a default starting value since the observable won't
    // emit until a change event is triggered
    startWith(isBuyDefault),
    map(isBuy => Object.freeze(new Field({ fieldName: 'isBuy', value: isBuy })))
  )

  const validDateRange = [parse('2019-05-01'), parse('2019-05-31')]
  const validDateObject = () => concatMap(([dateString, fieldName]) => {
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

  const startDate = document.getElementById('start')
  const startDefault = startDate.value
  const startDateEvents = fromEvent(startDate, 'input').pipe(
    map(event => event.target.value),
    startWith(startDefault),
    map(dateString => [dateString, 'start']),
    validDateObject(),
  )

  const endDate = document.getElementById('end')
  const endDefault = endDate.value
  const endDateEvents = fromEvent(endDate, 'input').pipe(
    map(event => event.target.value),
    startWith(endDefault),
    map(dateString => [dateString, 'end']),
    validDateObject(),
  )

  const dateInputSubscriber = field => {
    console.log('?', field)
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

  startDateEvents.subscribe(dateInputSubscriber)
  endDateEvents.subscribe(dateInputSubscriber)

  const formValidation = combineLatest(isBuyEvents, startDateEvents, endDateEvents).pipe(
    map(fields => Object.freeze(fields.reduce((fieldObj, field) => ({ ...fieldObj, [field.fieldName]: field }), {}))),
    concatMap(fields => {
      console.log(fields)
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

  const formErrorsEl = document.getElementById('form-errors')
  formValidation.subscribe(form => {
    while(formErrorsEl.lastChild) {
      formErrorsEl.lastChild.remove()
    } 

    for (let error of form.errors) {
      const errorEl = document.createElement('div')
      errorEl.textContent = `Field: ${error.fieldName} - ${error.message}`
      formErrorsEl.appendChild(errorEl)
    }
  })

  return formValidation.pipe(
    concatMap(form => {
      console.log(form.hasErrors)
      console.log(form.errors)
      console.log(Object.values(form.fields).map(x => x.hasError))
      const { isBuy, start, end } = form.fields
      if (form.hasErrors) {
        return of(null)
      }
      return of([isBuy.value, [start.value, end.value]])
    })
  )
}