import { of, combineLatest } from 'rxjs'
import { ajax } from 'rxjs/ajax'
import { filter, pluck, reduce, map, concatMap } from 'rxjs/operators'

import { format, parse, isWithinRange, endOfDay } from 'date-fns'

import startValidation from './validation'

// Data filtering functions! :3

// collects expanded data back into an array. It's easier to handle an array of the
// transactions than each transactions by its self when manipulating the DOM
const backToArray = reduce((data, x) => [...data, x], [])

const filterTransactionType = transactionType => filter(x => {
  return transactionType === 'all' ? true : transactionType === 'expense' ? x.is_buy : !x.is_buy
})

// get the data we care the most about
const plunkData = map(({ date, is_buy, quantity, unit_price }) => ({
  date,
  quantity,
  is_buy,
  unit_price,
}))

const inDateRange = ([start, end]) => filter(x => {
  // TODO: parsing error could occur here
  const date = parse(x.date)
  // adding one dya makes the range exclusive
  return isWithinRange(date, start, end)
})

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
      const { date, unit_price, is_buy, quantity } = transaction
      let article = document.createElement('article')
      article.classList.add('transaction')

      let dateEl = document.createElement('div')
      dateEl.textContent = format(date, 'MMM, D')
      dateEl.classList.add('date')
      article.appendChild(dateEl)

      let amount = document.createElement('div')
      amount.textContent = quantity * unit_price
      amount.classList.add('amount')
      article.appendChild(amount)

      transactionsEl.appendChild(article)
    }
  })
}

main()