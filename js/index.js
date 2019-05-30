import { of, combineLatest } from 'rxjs'
import { ajax } from 'rxjs/ajax'
import { filter, pluck, reduce, map, concatMap } from 'rxjs/operators'

import { format, parse, isWithinRange, endOfDay } from 'date-fns'

import startValidation from './validation'

// Data filtering functions! :3

// collects expanded data back into an array. It's easier to handle an array of the
// transactions than each transactions by its self when manipulating the DOM
const backToArray = reduce((data, x) => [...data, x], [])

// get the data we care the most about
const plunkData = map(({ date, is_buy, quantity, unit_price }) => ({
  date,
  quantity,
  is_buy,
  unit_price,
}))

const addTransactionType = map(
  x => (
    Object.freeze({
      ...x,
      transactionType: x.is_buy ? 'expense' : 'income'
    })
  )
)

const addCost = map(transaction => {
  // slices the unit_price so we can combine the dollars and cents
  // so 20.45 becomes 2045
  // We want to work with `cents` not fractions of dollars
  // This avoid floating point issues when working with fractions
  const [whole, dec] = transaction.unit_price.toString().split('.')
  // dec should have a length of 2 so if it doesn't exist, make it '00'
  // if it only have a length of 1, than add a '0' so that '3' would become '30'
  const decimal = dec == null ? '00' : dec.length === 1 ? `${dec}0` : dec 

  const price = new Number(`${whole}${decimal}`)
  const cost = transaction.quantity * price
  // break the cost back into dollars and cents
  // Gets the last 2 numbers in the string
  const cents = cost.toString().slice(-2)
  // Gets all numbers in the string expect for the last two
  const dollars = cost.toString().slice(0, -2)

  return Object.freeze({
    ...transaction,
    cost: `${dollars}.${cents}`,
  })
})

// formats the cost with commas
// 123456.78 into 123,456.78
const addFormattedCost = map(transaction => {
  const [whole, dec] = transaction.cost.split('.')
  const chunks = []

  for(let i=whole.length; i >= 0; i-=3) {
    const start = i - 3 < 0 ? 0 : i - 3
    const slice = whole.slice(start, i)
    if (slice.length) {
      chunks.push(slice)
    }
  }

  return Object.freeze({
    ...transaction,
    formattedCost: `${chunks.reverse().join(',')}.${dec}`
  })
})

function filterTransactionType(transactionType) {
  return filter(x => transactionType === 'all'
    ? true
    : transactionType === 'expense' ? x.is_buy : !x.is_buy)
}

function inDateRange([start, end]) {
  return filter(x => {
    // TODO: parsing error could occur here
    const date = parse(x.date)
    // adding one dya makes the range exclusive
    return isWithinRange(date, start, end)
  })
}

function main() {

  const form$ = startValidation()

  const data$ = ajax.getJSON('/transactions.json').pipe(
    pluck('transactions'),
  )

  const transactionsEl = document.getElementById('transactions')
  const resultsEl = document.getElementById('num-of-results')

  // Combine our data and form data so we can filter the transactions 
  combineLatest(data$, form$).pipe(
    concatMap(([data, form]) => {
      // If the form object has errors we'll emit an empty array
      // Because the form data is invalid, we can't filter the data so
      // returning an empty array will allow us to let the user see that
      // the current form filtering won't produce any results to display
      if (form.hasErrors) {
        return of([])
      }

      const transactionType = form.fields['transaction-type'].value
      const startDate = form.fields['start'].value
      const endDate = form.fields['end'].value

      return of(...data).pipe(
        filterTransactionType(transactionType),
        inDateRange([startDate, endDate]),
        plunkData,
        addTransactionType,
        addCost,
        addFormattedCost,
        backToArray,
      )
    })
  // Below is where we'll update the DOM to display the filtered transactions
  ).subscribe(transactions => {
    // This will remove all child elements from the transaction element
    while (transactionsEl.lastChild) {
      transactionsEl.lastChild.remove()
    }

    resultsEl.textContent = `There are ${transactions.length} results.`

    for (let transaction of transactions) {
      const {
        date,
        unit_price,
        quantity,
        formattedCost,
        transactionType,
      } = transaction

      let article = document.createElement('article')
      article.classList.add('transaction')

      let dateEl = document.createElement('div')
      dateEl.textContent = format(date, 'MMM DD')
      dateEl.classList.add('date')
      article.appendChild(dateEl)

      let breakDownEl = document.createElement('div')
      breakDownEl.textContent = `${quantity} x ${unit_price} =`
      breakDownEl.classList.add('break-down')
      article.appendChild(breakDownEl)

      let amount = document.createElement('div')
      const sign = transactionType === 'expense' ? '-' : ''
      amount.textContent = `${sign}${formattedCost} ISK`
      amount.classList.add('amount')
      amount.classList.add(transactionType)
      article.appendChild(amount)

      transactionsEl.appendChild(article)
    }
  })
}

main()